/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { formatAppError, readJsonResponse, reportAppError } from '@/lib/app-error';

import { readLocalSetting } from '@/lib/local-settings';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { getTMDBImageUrl, TMDBItem } from '@/lib/tmdb.client';
import { DoubanItem } from '@/lib/types';
import { base58Encode, processImageUrl } from '@/lib/utils';

import AIChatPanel from '@/components/AIChatPanel';
import BannerCarousel from '@/components/BannerCarousel';
import ContinueWatching from '@/components/ContinueWatching';
import FireworksCanvas from '@/components/FireworksCanvas';
import HttpWarningDialog from '@/components/HttpWarningDialog';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import Toast, { ToastProps } from '@/components/Toast';
import VideoCard from '@/components/VideoCard';

// 首页行内容淡入的错峰延迟（仅用于首次挂载；backwards 填充避免动画结束后残留层叠上下文）
const staggerIn = (index: number): React.CSSProperties => ({
  animationDelay: `${Math.min(index, 8) * 30}ms`,
  animationFillMode: 'backwards',
});

// 首页模块配置接口
interface HomeModule {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [hotDuanju, setHotDuanju] = useState<any[]>([]);
  const [upcomingContent, setUpcomingContent] = useState<TMDBItem[]>([]);
  const [duanjuStatus, setDuanjuStatus] = useState('正在加载短剧内容…');
  const [upcomingStatus, setUpcomingStatus] = useState('正在加载即将上映内容…');
  const [bangumiCalendarData, setBangumiCalendarData] = useState<
    BangumiCalendarData[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [homeError, setHomeError] = useState('');
  const { announcement, announcementDisplayMode } = useSite();
  // 首页模块配置状态
  const [homeModules, setHomeModules] = useState<HomeModule[]>([
    { id: 'hotMovies', name: '热门电影', enabled: true, order: 0 },
    { id: 'hotDuanju', name: '热播短剧', enabled: true, order: 1 },
    { id: 'bangumiCalendar', name: '新番放送', enabled: true, order: 2 },
    { id: 'hotTvShows', name: '热门剧集', enabled: true, order: 3 },
    { id: 'hotVarietyShows', name: '热门综艺', enabled: true, order: 4 },
    { id: 'upcomingContent', name: '即将上映', enabled: true, order: 5 },
  ]);
  const [activeHomeModule, setActiveHomeModule] = useState<string | null>(null);
  const [homeBannerEnabled, setHomeBannerEnabled] = useState(true);
  const [homeContinueWatchingEnabled, setHomeContinueWatchingEnabled] =
    useState(true);

  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showHttpWarning, setShowHttpWarning] = useState(true);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDefaultMessageNoVideo, setAiDefaultMessageNoVideo] = useState(
    '你好！我是ApexTV的AI影视助手。想看什么电影或剧集？需要推荐吗？'
  );
  const [netdiskTempPlayEnabled, setNetdiskTempPlayEnabled] = useState(false);
  const [showDirectPlayDialog, setShowDirectPlayDialog] = useState(false);
  const [directPlayUrl, setDirectPlayUrl] = useState('');
  const [directPlaySubmitting, setDirectPlaySubmitting] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const detectNetdiskLink = (
    url: string
  ): {
    provider: 'quark' | 'mobile' | 'baidu' | 'tianyi' | '123' | 'uc' | '115';
    shareUrl: string;
    passcode?: string;
  } | null => {
    const trimmed = url.trim();

    const pickPasscode = (...values: Array<string | undefined>) =>
      values.map((item) => item?.trim()).find(Boolean);

    const inlinePasscode = (text: string) =>
      pickPasscode(
        text.match(
          /(?:提取码|访问码|密码)\s*[:：=]?\s*([a-zA-Z0-9]{4,8})/i
        )?.[1],
        text.match(/[?&](?:pwd|passcode|accessCode)=([^&\s]+)/i)?.[1]
      );

    if (
      /https:\/\/(?:www\.)?123(?:684|865|912|pan)\.(?:com|cn)\/s\//i.test(
        trimmed
      )
    ) {
      return {
        provider: '123',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&]pwd=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (
      /https:\/\/cloud\.189\.cn\/(web\/share\?code=|t\/)/i.test(trimmed) ||
      /https:\/\/h5\.cloud\.189\.cn\/share\.html#\/t\//i.test(trimmed)
    ) {
      return {
        provider: 'tianyi',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&]pwd=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/pan\.baidu\.com\/(s\/|wap\/init\?surl=)/i.test(trimmed)) {
      return {
        provider: 'baidu',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:pwd|accessCode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/https:\/\/pan\.quark\.cn\/s\//i.test(trimmed)) {
      return {
        provider: 'quark',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:pwd|passcode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/https:\/\/drive\.uc\.cn\/s\//i.test(trimmed)) {
      return {
        provider: 'uc',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:pwd|passcode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    if (/https:\/\/(?:yun|caiyun)\.139\.com\//i.test(trimmed)) {
      return { provider: 'mobile', shareUrl: trimmed };
    }

    if (/https:\/\/(?:115|anxia|115cdn)\.com\/s\//i.test(trimmed)) {
      return {
        provider: '115',
        shareUrl: trimmed,
        passcode: pickPasscode(
          trimmed.match(/[?&](?:password|pwd|passcode)=([^&]+)/i)?.[1],
          inlinePasscode(trimmed)
        ),
      };
    }

    return null;
  };

  useEffect(() => {
    const action = searchParams.get('action');
    if (action !== 'direct-play' && action !== 'ai-chat') return;
    if (action === 'ai-chat' && !aiEnabled) return;

    if (action === 'direct-play') {
      setDirectPlayUrl('');
      setShowDirectPlayDialog(true);
    } else {
      setShowAIChat(true);
    }

    const remaining = new URLSearchParams(searchParams.toString());
    remaining.delete('action');
    router.replace(remaining.size ? '/?' + remaining.toString() : '/', { scroll: false });
  }, [searchParams, router, aiEnabled]);

  const submitDirectPlay = async () => {
    const trimmed = directPlayUrl.trim();
    if (!trimmed) return;
    setDirectPlaySubmitting(true);
    try {
      const netdisk = detectNetdiskLink(trimmed);
      if (netdisk && !netdiskTempPlayEnabled) {
        throw new Error('无权限使用临时播放');
      }

      if (netdisk) {
        const source =
          netdisk.provider === 'mobile'
            ? 'netdisk-mobile'
            : netdisk.provider === 'baidu'
            ? 'netdisk-baidu'
            : netdisk.provider === 'tianyi'
            ? 'netdisk-tianyi'
            : netdisk.provider === '115'
            ? 'netdisk-115'
            : netdisk.provider === 'uc'
            ? 'netdisk-uc'
            : netdisk.provider === '123'
            ? 'netdisk-123'
            : 'netdisk-quark';
        const id = base58Encode(
          JSON.stringify({
            shareUrl: netdisk.shareUrl,
            passcode: netdisk.passcode || '',
          })
        );
        if (!id) {
          throw new Error('网盘链接编码失败');
        }
        const targetUrl = `/play?source=${encodeURIComponent(
          source
        )}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(
          '网盘直链播放'
        )}`;
        setShowDirectPlayDialog(false);
        setDirectPlayUrl('');
        window.location.assign(targetUrl);
        return;
      }

      const encoded = base58Encode(trimmed);
      if (!encoded) return;
      const targetUrl = `/play?source=directplay&id=${encodeURIComponent(
        encoded
      )}`;
      setShowDirectPlayDialog(false);
      setDirectPlayUrl('');
      window.location.assign(targetUrl);
    } catch (error) {
      setToast({
        message: formatAppError(error, '播放'),
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setDirectPlaySubmitting(false);
    }
  };

  const loadHomeLayoutSettings = () => {
    setHomeModules(readLocalSetting('homeModules'));
    setHomeBannerEnabled(readLocalSetting('homeBannerEnabled'));
    setHomeContinueWatchingEnabled(readLocalSetting('homeContinueWatchingEnabled'));
  };

  // 加载首页模块配置
  useEffect(() => {
    loadHomeLayoutSettings();
  }, []);

  // 监听首页模块配置更新事件
  useEffect(() => {
    const handleHomeModulesUpdated = () => {
      loadHomeLayoutSettings();
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('home')) loadHomeLayoutSettings();
    };
    window.addEventListener('homeModulesUpdated', handleHomeModulesUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(
        'homeModulesUpdated',
        handleHomeModulesUpdated
      );
    };
  }, []);

  // 检查AI功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        (window as any).RUNTIME_CONFIG?.AI_ENABLED &&
        (window as any).RUNTIME_CONFIG?.AI_ENABLE_HOMEPAGE_ENTRY;
      setAiEnabled(enabled);

      // 加载AI默认消息配置
      const defaultMsg = (window as any).RUNTIME_CONFIG
        ?.AI_DEFAULT_MESSAGE_NO_VIDEO;
      if (defaultMsg) {
        setAiDefaultMessageNoVideo(defaultMsg);
      }
    }
  }, []);

  // 检查网盘临时播放权限，仅有权限时在直链播放弹窗展示网盘在线播放提示
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = !!(window as any).RUNTIME_CONFIG
        ?.NETDISK_TEMP_PLAY_ENABLED;
      setNetdiskTempPlayEnabled(enabled);
    }
  }, []);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      // 会话级标记：只在首次访问站点时弹出，导航切回首页不重复弹
      if (sessionStorage.getItem('announcementShown')) {
        return;
      }
      // 每次显示模式：每次新会话首次访问弹出一次
      if (announcementDisplayMode === 'every') {
        setShowAnnouncement(true);
        sessionStorage.setItem('announcementShown', '1');
        return;
      }
      // 单次显示模式：localStorage 记住已看过的公告文本，换公告则重新弹出
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement, announcementDisplayMode]);

  useEffect(() => {
    const CACHE_DURATION = 60 * 60 * 1000; // 1小时

    const getCache = (key: string) => {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        return { data, expired: Date.now() - timestamp > CACHE_DURATION };
      } catch {
        return null;
      }
    };

    const setCache = (key: string, data: any) => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch {
        // Ignore localStorage errors
      }
    };

    const moviesCache = getCache('homepage_movies');
    const tvShowsCache = getCache('homepage_tvshows');
    const varietyCache = getCache('homepage_variety');
    const bangumiCache = getCache('homepage_bangumi');
    const duanjuCache = getCache('homepage_duanju');
    const upcomingCache = getCache('homepage_upcoming');

    if (moviesCache?.data) setHotMovies(moviesCache.data);
    if (tvShowsCache?.data) setHotTvShows(tvShowsCache.data);
    if (varietyCache?.data) setHotVarietyShows(varietyCache.data);
    if (bangumiCache?.data) setBangumiCalendarData(bangumiCache.data);
    if (duanjuCache?.data) setHotDuanju(duanjuCache.data);
    if (upcomingCache?.data) setUpcomingContent(upcomingCache.data);

    const hasCache =
      moviesCache ||
      tvShowsCache ||
      varietyCache ||
      bangumiCache ||
      duanjuCache ||
      upcomingCache;
    if (hasCache) setLoading(false);

    const needsRefresh =
      !moviesCache ||
      moviesCache.expired ||
      !tvShowsCache ||
      tvShowsCache.expired ||
      !varietyCache ||
      varietyCache.expired ||
      !bangumiCache ||
      bangumiCache.expired ||
      !duanjuCache ||
      duanjuCache.expired ||
      !upcomingCache ||
      upcomingCache.expired;

    if (needsRefresh) {
      (async () => {
        try {
          const [
            moviesData,
            tvShowsData,
            varietyShowsData,
            bangumiCalendarData,
          ] = await Promise.all([
            getDoubanCategories({
              kind: 'movie',
              category: '热门',
              type: '全部',
            }).catch((error) => {
              reportAppError(error, '获取热门电影数据');
              setHomeError(formatAppError(error, '获取热门电影数据'));
              return null;
            }),
            getDoubanCategories({
              kind: 'tv',
              category: 'tv',
              type: 'tv',
            }).catch((error) => {
              reportAppError(error, '获取热门剧集数据');
              setHomeError(formatAppError(error, '获取热门剧集数据'));
              return null;
            }),
            getDoubanCategories({
              kind: 'tv',
              category: 'show',
              type: 'show',
            }).catch((error) => {
              reportAppError(error, '获取热门综艺数据');
              setHomeError(formatAppError(error, '获取热门综艺数据'));
              return null;
            }),
            GetBangumiCalendarData().catch((error) => {
              reportAppError(error, '获取新番放送数据');
              setHomeError(formatAppError(error, '获取新番放送数据'));
              return [];
            }),
          ]);

          if (moviesData?.code === 200) {
            setHotMovies(moviesData.list);
            if (moviesData.list && moviesData.list.length > 0) {
              setCache('homepage_movies', moviesData.list);
            }
          }
          if (tvShowsData?.code === 200) {
            setHotTvShows(tvShowsData.list);
            if (tvShowsData.list && tvShowsData.list.length > 0) {
              setCache('homepage_tvshows', tvShowsData.list);
            }
          }
          if (varietyShowsData?.code === 200) {
            setHotVarietyShows(varietyShowsData.list);
            if (varietyShowsData.list && varietyShowsData.list.length > 0) {
              setCache('homepage_variety', varietyShowsData.list);
            }
          }
          setBangumiCalendarData(bangumiCalendarData);
          if (bangumiCalendarData && bangumiCalendarData.length > 0) {
            setCache('homepage_bangumi', bangumiCalendarData);
          }

          try {
            const response = await fetch('/api/duanju/recommends');
            const result = await readJsonResponse<any>(response, '获取推荐');
            if (response.ok && result.code === 200 && Array.isArray(result.data) && result.data.length > 0) {
              setHotDuanju(result.data);
              setCache('homepage_duanju', result.data);
              setDuanjuStatus('');
            } else {
              setDuanjuStatus(result.message || '暂未返回可展示的短剧内容');
            }
          } catch (error) {
            reportAppError(error, '获取热播短剧数据');
            setDuanjuStatus(formatAppError(error, '获取热播短剧数据'));
          }

          try {
            const response = await fetch('/api/tmdb/upcoming');
            const result = await readJsonResponse<any>(response, '获取推荐');
            if (response.ok && result.code === 200 && Array.isArray(result.data) && result.data.length > 0) {
              const sorted = [...result.data].sort((a, b) => {
                const dateA = new Date(a.release_date || '9999-12-31').getTime();
                const dateB = new Date(b.release_date || '9999-12-31').getTime();
                return dateA - dateB;
              });
              setUpcomingContent(sorted);
              setCache('homepage_upcoming', sorted);
              setUpcomingStatus('');
            } else {
              setUpcomingStatus(result.message || '暂未返回可展示的即将上映内容');
            }
          } catch (error) {
            reportAppError(error, '获取TMDB即将上映数据');
            setUpcomingStatus(formatAppError(error, '获取TMDB即将上映数据'));
          }

          setLoading(false);
        } catch (error) {
          reportAppError(error, '获取推荐数据');
          setHomeError(formatAppError(error, '获取推荐数据'));
          setDuanjuStatus('短剧内容暂时获取失败，请稍后刷新重试');
          setUpcomingStatus('即将上映内容暂时获取失败，请稍后刷新重试');
          setLoading(false);
        }
      })();
    }
  }, []);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  // 渲染模块的函数
  const renderModule = (moduleId: string) => {
    switch (moduleId) {
      case 'hotMovies':
        return (
          <section key='hotMovies' className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                热门电影
              </h2>
              <Link
                href='/douban?type=movie'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className='apex-rail-item'
                    >
                      <div className='aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2' />
                      <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4' />
                    </div>
                  ))
                : hotMovies.map((movie, index) => (
                    <div
                      key={movie.id}
                      className='ptv-fade-in apex-rail-item'
                      style={staggerIn(index)}
                    >
                      <VideoCard
                        id={movie.id}
                        poster={movie.poster}
                        title={movie.title}
                        year={movie.year}
                        rate={movie.rate}
                        type='movie'
                        from='douban'
                        douban_id={movie.id ? parseInt(movie.id) : undefined}
                      />
                    </div>
                  ))}
            </ScrollableRow>
          </section>
        );

      case 'hotDuanju':
        if (hotDuanju.length === 0) return <div className='f1-home-empty' role='status'><strong>热播短剧</strong><p>{duanjuStatus}</p></div>;
        return (
          <section key='hotDuanju' className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                热播短剧
              </h2>
              <Link
                href='/duanju'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className='apex-rail-item'
                    >
                      <div className='aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2' />
                      <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4' />
                    </div>
                  ))
                : hotDuanju.map((duanju, index) => (
                    <div
                      key={duanju.id + duanju.source}
                      className='ptv-fade-in apex-rail-item'
                      style={staggerIn(index)}
                    >
                      <VideoCard
                        id={duanju.id}
                        source={duanju.source}
                        poster={duanju.poster}
                        title={duanju.title}
                        year={duanju.year}
                        type='tv'
                        from='search'
                        isDuanju
                        source_name={duanju.source_name}
                        episodes={duanju.episodes?.length}
                        douban_id={duanju.douban_id}
                        cmsData={{
                          desc: duanju.desc,
                          episodes: duanju.episodes,
                          episodes_titles: duanju.episodes_titles,
                        }}
                      />
                    </div>
                  ))}
            </ScrollableRow>
          </section>
        );

      case 'bangumiCalendar':
        return (
          <section key='bangumiCalendar' className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                新番放送
              </h2>
              <Link
                href='/douban?type=anime'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className='apex-rail-item'
                    >
                      <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                        <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                      </div>
                      <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
                    </div>
                  ))
                : (() => {
                    const today = new Date();
                    const weekdays = [
                      'Sun',
                      'Mon',
                      'Tue',
                      'Wed',
                      'Thu',
                      'Fri',
                      'Sat',
                    ];
                    const currentWeekday = weekdays[today.getDay()];
                    const todayAnimes =
                      bangumiCalendarData
                        .find((item) => item.weekday.en === currentWeekday)
                        ?.items.filter((anime) => anime.images) || [];

                    return todayAnimes.map((anime, index) => (
                      <div
                        key={`${anime.id}-${index}`}
                        className='ptv-fade-in apex-rail-item'
                        style={staggerIn(index)}
                      >
                        <VideoCard
                          from='douban'
                          title={anime.name_cn || anime.name}
                          poster={
                            anime.images?.large ||
                            anime.images?.common ||
                            anime.images?.medium ||
                            anime.images?.small ||
                            anime.images?.grid ||
                            ''
                          }
                          douban_id={anime.id}
                          rate={anime.rating?.score?.toFixed(1) || ''}
                          year={anime.air_date?.split('-')?.[0] || ''}
                          isBangumi={true}
                        />
                      </div>
                    ));
                  })()}
            </ScrollableRow>
          </section>
        );

      case 'hotTvShows':
        return (
          <section key='hotTvShows' className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                热门剧集
              </h2>
              <Link
                href='/douban?type=tv'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className='apex-rail-item'
                    >
                      <div className='aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2' />
                      <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4' />
                    </div>
                  ))
                : hotTvShows.map((tvShow, index) => (
                    <div
                      key={tvShow.id}
                      className='ptv-fade-in apex-rail-item'
                      style={staggerIn(index)}
                    >
                      <VideoCard
                        id={tvShow.id}
                        poster={tvShow.poster}
                        title={tvShow.title}
                        year={tvShow.year}
                        rate={tvShow.rate}
                        type='tv'
                        from='douban'
                        douban_id={tvShow.id ? parseInt(tvShow.id) : undefined}
                      />
                    </div>
                  ))}
            </ScrollableRow>
          </section>
        );

      case 'hotVarietyShows':
        return (
          <section key='hotVarietyShows' className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                热门综艺
              </h2>
              <Link
                href='/douban?type=show'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className='apex-rail-item'
                    >
                      <div className='aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2' />
                      <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4' />
                    </div>
                  ))
                : hotVarietyShows.map((varietyShow, index) => (
                    <div
                      key={varietyShow.id}
                      className='ptv-fade-in apex-rail-item'
                      style={staggerIn(index)}
                    >
                      <VideoCard
                        id={varietyShow.id}
                        poster={varietyShow.poster}
                        title={varietyShow.title}
                        year={varietyShow.year}
                        rate={varietyShow.rate}
                        type='tv'
                        from='douban'
                        douban_id={
                          varietyShow.id ? parseInt(varietyShow.id) : undefined
                        }
                      />
                    </div>
                  ))}
            </ScrollableRow>
          </section>
        );

      case 'upcomingContent':
        if (upcomingContent.length === 0) return <div className='f1-home-empty' role='status'><strong>即将上映</strong><p>{upcomingStatus}</p></div>;
        return (
          <section key='upcomingContent' className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                即将上映
              </h2>
            </div>
            <ScrollableRow>
              {upcomingContent.map((item) => (
                <div
                  key={`${item.media_type}-${item.id}`}
                  className='apex-rail-item'
                >
                  <VideoCard
                    title={item.title}
                    poster={processImageUrl(getTMDBImageUrl(item.poster_path))}
                    year={item.release_date?.split('-')?.[0] || ''}
                    rate={
                      item.vote_average && item.vote_average > 0
                        ? item.vote_average.toFixed(1)
                        : ''
                    }
                    type={item.media_type === 'tv' ? 'tv' : 'movie'}
                    from='douban'
                    tmdb_id={item.id}
                    releaseDate={item.release_date}
                    isUpcoming={true}
                  />
                </div>
              ))}
            </ScrollableRow>
          </section>
        );

      default:
        return null;
    }
  };

  const enabledHomeModules = homeModules.filter((module) => module.enabled).sort((a, b) => a.order - b.order);
  const visibleHomeModule = enabledHomeModules.find((module) => module.id === activeHomeModule) || enabledHomeModules[0];
  const enabledModules = new Set(enabledHomeModules.map((module) => module.id));
  const suggestedVideos = [
    ...(enabledModules.has('hotTvShows') ? hotTvShows.map((item) => ({ item, kind: 'tv' as const, module: 'hotTvShows' })) : []),
    ...(enabledModules.has('hotMovies') ? hotMovies.map((item) => ({ item, kind: 'movie' as const, module: 'hotMovies' })) : []),
    ...(enabledModules.has('hotVarietyShows') ? hotVarietyShows.map((item) => ({ item, kind: 'tv' as const, module: 'hotVarietyShows' })) : []),
  ];
  const homePicks = suggestedVideos.filter((video) => video.module !== visibleHomeModule?.id).filter((video, index, list) =>
    list.findIndex((candidate) => candidate.item.title === video.item.title && candidate.item.year === video.item.year) === index
  );

  return (
    <PageLayout>
      {homeError && <p role='alert' className='text-red-500'>{homeError}</p>}
      <FireworksCanvas />
      {/* TMDB 热门轮播图 */}
      {homeBannerEnabled && (
        <div className='ptv-home-hero-wrap f1-home-hero'>
          <BannerCarousel delayLoad={true} />
        </div>
      )}

      <div className='ptv-home-content f1-home-content overflow-visible'>
        <div className='w-full mx-auto'>
          {/* 首页内容 */}
          <>
            {/* 源站寻片和AI问片入口 */}
            {/* 继续观看 */}
            {homeContinueWatchingEnabled && <ContinueWatching />}

            {/* 根据配置动态渲染首页模块 */}
            {visibleHomeModule && (
                <div className='f1-home-recommendations'>
                  <div className='f1-home-recommendations-heading'>
                    <h2>正在热播</h2>
                    <div className='f1-home-tabs' role='group' aria-label='首页推荐分类'>
                      {enabledHomeModules.map((module) => (
                        <button key={module.id} type='button' aria-pressed={visibleHomeModule.id === module.id}
                          onClick={() => setActiveHomeModule(module.id)}>{module.name}</button>
                      ))}
                    </div>
                  </div>
                  {renderModule(visibleHomeModule.id)}
                </div>
            )}
            {homePicks.length > 0 && (
              <section className='f1-home-picks-section' aria-label='为你推荐'>
                <h2>为你推荐</h2>
                <ScrollableRow key={visibleHomeModule?.id ?? 'home-picks'} scrollDistance={640} bottomPadding='pb-1'>
                  {homePicks.map(({ item, kind }) => (
                    <Link key={item.id + kind} href={{ pathname: '/play', query: { title: item.title, year: item.year, stype: kind } }} prefetch={false} className='f1-home-pick'>
                      <img src={processImageUrl(item.poster)} alt='' loading='lazy' />
                      <span className='f1-home-pick-copy'><strong>{item.title}</strong><small>{kind === 'movie' ? '电影' : '剧集'}{item.year ? ' · ' + item.year : ''}</small>{Number(item.rate) > 0 && <span className='f1-home-pick-rating'>★ {item.rate}</span>}</span>
                    </Link>
                  ))}
                </ScrollableRow>
              </section>
            )}


          </>
        </div>
      </div>

      {/* HTTP 环境警告弹窗 */}
      {showHttpWarning && (
        <HttpWarningDialog onClose={() => setShowHttpWarning(false)} />
      )}

      {/* AI问片面板 */}
      {aiEnabled && (
        <AIChatPanel
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
          welcomeMessage={aiDefaultMessageNoVideo}
        />
      )}

      {/* 公告弹窗 */}
      {showAnnouncement && (
        <div className='ptv-scrim-in fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
          <div className='ptv-modal-in bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3'>
              公告
            </h3>
            <div className='text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap'>
              {announcement}
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement || '')}
              className='w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {showDirectPlayDialog && (
        <div
          className='ptv-scrim-in fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'
          onClick={() => setShowDirectPlayDialog(false)}
        >
          <div
            className='ptv-modal-in bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                直链播放
              </h3>
              <button
                onClick={() => setShowDirectPlayDialog(false)}
                className='p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
                aria-label='关闭'
              >
                <span className='text-gray-600 dark:text-gray-400'>×</span>
              </button>
            </div>
            <div className='p-4 space-y-4'>
              <div className='text-sm text-gray-600 dark:text-gray-300'>
                请输入可直接播放的视频链接。
              </div>
              {netdiskTempPlayEnabled && (
                <div className='text-xs text-gray-500 dark:text-gray-400'>
                  支持夸克、UC、百度、天翼、移动、123、115 网盘在线播放。
                </div>
              )}
              <input
                value={directPlayUrl}
                onChange={(event) => setDirectPlayUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitDirectPlay();
                  }
                }}
                placeholder='https://example.com/video.m3u8'
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-apex-accent"
              />
              <div className='flex justify-end gap-2'>
                <button
                  onClick={() => setShowDirectPlayDialog(false)}
                  className='px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                >
                  取消
                </button>
                <button
                  onClick={submitDirectPlay}
                  disabled={!directPlayUrl.trim() || directPlaySubmitting}
                  className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {directPlaySubmitting ? '处理中...' : '开始播放'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
