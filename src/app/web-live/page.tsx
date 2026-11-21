'use client';

import { AlertTriangle, ChevronDown, Download, Info, Loader2, Play, Radio, SlidersHorizontal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useWebLiveSync } from '@/hooks/useWebLiveSync';
import { useYouTubeLiveRefresh } from '@/hooks/useYouTubeLiveRefresh';
import { useWebLiveRecovery } from '@/hooks/useWebLiveRecovery';
import { getWebLiveRoomUrl, webLiveSourceLabel, type WebLivePlayback, type WebLiveRoomInfo, type WebLiveSource, type WebLiveVariant, webLivePlatformName } from '@/lib/web-live';
import { chooseVariant, qualityName, qualityOptions, recoveryVariant, resolveVariant, type WebLivePreference } from '@/lib/web-live-variants';

import LiveTabs from '@/components/LiveTabs';
import LoadingStyle, {
  type LoadingStep,
  LoadingErrorStyle,
} from '@/components/LoadingStyle';
import PageLayout from '@/components/PageLayout';
import WebLiveRoomDetails, { WebLiveAvatar } from '@/components/WebLiveRoomInfo';
import WebLivePlayer from '@/components/WebLivePlayer';
import WebLivePlatformIcon from '@/components/WebLivePlatformIcon';
import TwitchLivePlayer from '@/components/TwitchLivePlayer';


/* 初始化加载动画（后台「个性化配置 → 初始化加载样式」可切换旧版/方格/魔法阵）。
 * 款式本身见 components/LoadingStyle。 */
type WebLiveLoadingStepKey = 'loading' | 'fetching' | 'ready';

const WEB_LIVE_LOADING_STEP_META: Record<
  WebLiveLoadingStepKey,
  LoadingStep
> = {
  loading: { label: '加载', icon: <Radio /> },
  fetching: { label: '获取', icon: <Download /> },
  ready: { label: '就绪', icon: <Play /> },
};

const WEB_LIVE_LOADING_STEPS: WebLiveLoadingStepKey[] = [
  'loading',
  'fetching',
  'ready',
];

/* 播放器蒙层只有两步：加载，然后播放 */
const WEB_LIVE_PLAYER_STEPS: LoadingStep[] = [
  { label: '加载', icon: <Loader2 /> },
  { label: '播放', icon: <Play /> },
];

export default function WebLivePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<'loading' | 'fetching' | 'ready'>('loading');
  const [loadingMessage, setLoadingMessage] = useState('正在加载直播源...');
  const [sources, setSources] = useState<WebLiveSource[]>([]);
  const [sourcesError, setSourcesError] = useState('');
  const [currentSource, setCurrentSource] = useState<WebLiveSource | null>(null);
  const [playback, setPlayback] = useState<WebLivePlayback | null>(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectionNotice, setSelectionNotice] = useState('');
  const [showAdvancedPlayback, setShowAdvancedPlayback] = useState(false);
  const preferenceRef = useRef<WebLivePreference | null>(null);
  const failedVariantsRef = useRef(new Set<string>());
  const stablePlaybackTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const originalVideoUrl = playback?.originalUrl || '';
  const [streamInfo, setStreamInfo] = useState<WebLiveRoomInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'platforms'>('rooms');
  const [isChannelListCollapsed, setIsChannelListCollapsed] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canAutoRetry, setCanAutoRetry] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isWebLiveEnabled, setIsWebLiveEnabled] = useState<boolean | null>(null);
  const hasAutoLoadedRef = useRef(false); // 防止重复自动加载
  const streamRequestRef = useRef<AbortController | null>(null);

  useYouTubeLiveRefresh(currentSource, isVideoLoading, (result) => {
    setPlayback(previous => previous?.embedUrl === result.embedUrl && previous?.liveStatus === result.liveStatus ? previous : result);
    setStreamInfo(result);
    setErrorMessage(null);
    setCanAutoRetry(false);
    setErrorCode('');
  });

  const resetRecovery = useWebLiveRecovery({
    source: currentSource,
    phase: errorMessage ? canAutoRetry ? 'retry' : 'idle' : playback?.liveStatus === 'offline' ? 'waiting' : 'idle',
    paused: isVideoLoading,
    onReady: () => currentSource ? handleSourceClick(currentSource, true) : undefined,
    onOffline: (result) => {
      setPlayback(result);
      setStreamInfo(previous => ({ ...previous, ...result, avatar: result.avatar || previous?.avatar, cover: result.cover || previous?.cover }));
      setErrorMessage(null);
      setCanAutoRetry(false);
      setErrorCode('');
    },
    onError: (message, retryable, code) => {
      setErrorMessage(message);
      setCanAutoRetry(retryable);
      setErrorCode(code || 'NETWORK_ERROR');
    },
    onExhausted: () => {
      setCanAutoRetry(false);
      setErrorMessage('多次重连仍未成功，请检查自定义地址；临时签名地址可能已过期，需要更新。');
    },
  });

  // 观影室同步功能
  const webLiveSync = useWebLiveSync({
    currentSourceKey: currentSource?.key || '',
    currentSourceName: currentSource?.name || '',
    currentSourcePlatform: currentSource?.platform || '',
    currentSourceRoomId: currentSource?.roomId || '',
    onSourceChange: (sourceKey, platform, roomId) => {
      // 房员接收到直播源切换指令
      if (!sources || !Array.isArray(sources)) return;
      const source = sources.find(s => s.key === sourceKey);
      if (source) {
        handleSourceClick(source);
      }
    },
  });

  useEffect(() => {
    const controller = new AbortController();

    if (typeof window !== 'undefined') {
      // 检查网络直播功能是否启用
      const runtimeConfig = (window as any).RUNTIME_CONFIG;
      const enabled = runtimeConfig?.WEB_LIVE_ENABLED ?? false;
      setIsWebLiveEnabled(enabled);

      if (enabled) {
        fetchSources(controller.signal);
      } else {
        setLoading(false);
      }
    }

    return () => {
      controller.abort();
    };
  }, []);

  const fetchSources = async (signal: AbortSignal) => {
    try {
      setLoading(true);
      setLoadingStage('loading');
      setLoadingMessage('正在加载直播源...');
      setSourcesError('');
      const res = await fetch('/api/web-live/sources', { signal });
      if (!res.ok) throw new Error('获取直播源失败');
      setLoadingStage('fetching');
      const data = await res.json();
      if (signal.aborted) return;
      setSources(data);
      setLoadingStage('ready');
    } catch {
      if (!signal.aborted) setSourcesError('获取直播源失败，请刷新页面重试。');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  // 当 sources 加载完成后，检查 URL 参数并自动加载对应的频道
  useEffect(() => {
    if (!sources || sources.length === 0) return;

    // 直接从 searchParams 读取，而不是从 useState
    const needLoadPlatform = searchParams.get('platform');
    const needLoadRoomId = searchParams.get('roomId');

    if (!needLoadPlatform || !needLoadRoomId) {
      hasAutoLoadedRef.current = false; // 重置标志
      return;
    }

    // 检查是否已经加载了这个频道
    if (currentSource?.platform === needLoadPlatform && currentSource?.roomId === needLoadRoomId) {
      return;
    }

    // 防止重复加载
    if (hasAutoLoadedRef.current) {
      return;
    }

    hasAutoLoadedRef.current = true;

    // 查找匹配的 source
    const foundSource = sources.find(s => s.platform === needLoadPlatform && s.roomId === needLoadRoomId);
    if (foundSource) {
      handleSourceClick(foundSource);
    } else {
      hasAutoLoadedRef.current = false; // 重置标志以便重试
    }
  }, [sources, searchParams]);

  useEffect(() => () => {
    streamRequestRef.current?.abort();
    clearTimeout(stablePlaybackTimerRef.current);
  }, []);

  const handleSourceClick = async (source: WebLiveSource, automatic = false) => {
    clearTimeout(stablePlaybackTimerRef.current);
    if (!automatic) {
      resetRecovery();
      failedVariantsRef.current.clear();
      if (source.key !== currentSource?.key) preferenceRef.current = null;
    }
    streamRequestRef.current?.abort();
    const controller = new AbortController();
    streamRequestRef.current = controller;
    if (source.key !== currentSource?.key) {
      setPlayback(null);
      setSelectedVariant('');
      setSelectionNotice('');
    }
    setCurrentSource(source);
    setIsVideoLoading(true);
    setErrorMessage(null);
    setCanAutoRetry(false);
    setErrorCode('');
    if (!automatic) setStreamInfo(null);

    const params = new URLSearchParams(searchParams.toString());
    params.set('platform', source.platform);
    params.set('roomId', source.roomId);
    router.replace(`/web-live?${params.toString()}`);

    try {
      const query = new URLSearchParams({ platform: source.platform, roomId: source.roomId, sourceKey: source.key });
      let response = await fetch(`/api/web-live/stream?${query}`, { signal: controller.signal });
      if (response.status === 404) {
        const refreshed = await fetch('/api/web-live/sources', { signal: controller.signal });
        if (refreshed.ok) {
          const updatedSources: WebLiveSource[] = await refreshed.json();
          if (controller.signal.aborted) return;
          setSources(updatedSources);
          const updated = updatedSources.find((item) => item.key === source.key && !item.disabled);
          if (!updated) throw Object.assign(new Error('直播源已不存在或已停用，请选择其他房间'), { retryable: false, code: 'SOURCE_MISSING' });
          setCurrentSource(updated);
          query.set('platform', updated.platform);
          query.set('roomId', updated.roomId);
          response = await fetch(`/api/web-live/stream?${query}`, { signal: controller.signal });
        }
      }
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw Object.assign(new Error(data.error || '获取直播流失败'), {
        retryable: data.retryable ?? response.status >= 500,
        code: data.code || 'NETWORK_ERROR',
      });
      const result = data as WebLivePlayback;
      setPlayback(result);
      setStreamInfo(result);
      const variants = result.variants || [];
      const preference = preferenceRef.current;
      const resolved = resolveVariant(variants, preference);
      const alternative = ['huya', 'bilibili'].includes(source.platform) && automatic && failedVariantsRef.current.size
        ? recoveryVariant(variants, preference, failedVariantsRef.current)
        : undefined;
      const preferred = alternative || resolved.selected;
      setSelectedVariant(preferred?.id || '');
      setSelectionNotice(alternative
        ? qualityName(alternative) === preference?.quality
          ? '上一条线路播放失败，已保留画质并尝试其他线路。'
          : '较高画质的线路暂不可用，已尝试较低画质；你仍可手动切换。'
        : resolved.fallback
        ? '原画质或线路暂不可用，已切换到当前可用选项。' : '');
      if (automatic && !alternative) failedVariantsRef.current.clear();
      if (preferred) preferenceRef.current = { quality: qualityName(preferred), cdn: preferred.cdn, type: preferred.type };
    } catch (error) {
      if (!controller.signal.aborted) {
        const failure = error as Error & { retryable?: boolean; code?: string };
        setErrorMessage(failure instanceof Error ? failure.message : '获取直播流失败');
        setCanAutoRetry(failure.retryable !== false);
        setErrorCode(failure.code || 'NETWORK_ERROR');
      }
    } finally {
      if (!controller.signal.aborted) setIsVideoLoading(false);
    }
  };

  const handlePlaybackFailure = (message: string, retryable: boolean, code = 'NETWORK_ERROR') => {
    clearTimeout(stablePlaybackTimerRef.current);
    const customExpired = currentSource?.platform === 'custom' && code === 'HTTP_EXPIRED';
    const customEnded = currentSource?.platform === 'custom' && code === 'PLAYBACK_ENDED';
    if (currentSource && ['huya', 'bilibili'].includes(currentSource.platform) && selectedVariant) failedVariantsRef.current.add(selectedVariant);
    setErrorMessage(customExpired ? '自定义播放地址已失效或访问被拒绝，请更新源地址；系统无法替外部源续签。' : customEnded ? '自定义直播源已结束，请检查是否为回放地址或需要更新的临时地址。' : message);
    setCanAutoRetry(retryable && !customExpired && !customEnded);
    setErrorCode(customExpired ? 'CUSTOM_URL_EXPIRED' : code);
  };

  const handlePlaying = () => {
    clearTimeout(stablePlaybackTimerRef.current);
    // 短暂出画面后立即断流不算恢复，连续播放后才重置退避和失败线路。
    stablePlaybackTimerRef.current = setTimeout(() => {
      resetRecovery();
      failedVariantsRef.current.clear();
    }, 15000);
    setCanAutoRetry(false);
    setErrorMessage(null);
    setErrorCode('');
    setStreamInfo(previous => ({ ...previous, liveStatus: 'live' }));
  };

  const handleTwitchStatus = (status: 'live' | 'offline' | 'unknown') => {
    setStreamInfo(previous => ({ ...previous, liveStatus: status }));
    setPlayback(previous => previous ? { ...previous, liveStatus: status } : previous);
    setErrorMessage(null);
    setCanAutoRetry(false);
  };

  const getRoomUrl = (source: WebLiveSource) => getWebLiveRoomUrl(source.platform, source.roomId);
  const variant = playback?.variants?.find((item) => item.id === selectedVariant);
  const variants = playback?.variants || [];
  const qualities = qualityOptions(variants);
  const qualityVariants = variant ? variants.filter((item) => qualityName(item) === qualityName(variant)) : [];
  const cdns = Array.from(new Set(qualityVariants.map((item) => item.cdn || '')));
  const protocols = qualityVariants.filter((item) => (item.cdn || '') === (variant?.cdn || ''));
  const protocolTypes = Array.from(new Set(protocols.map((item) => item.type)));
  const selectVariant = (item: WebLiveVariant | undefined, notice = '') => {
    if (!item) return;
    clearTimeout(stablePlaybackTimerRef.current);
    streamRequestRef.current?.abort();
    resetRecovery();
    failedVariantsRef.current.clear();
    setIsVideoLoading(false);
    setErrorMessage(null);
    setCanAutoRetry(false);
    setErrorCode('');
    setSelectionNotice(notice);
    preferenceRef.current = { quality: qualityName(item), cdn: item.cdn, type: item.type };
    setSelectedVariant(item.id);
  };

  const platforms = Array.from(new Set(sources.map(s => s.platform)));

  // 根据选中的平台筛选房间
  const filteredSources = selectedPlatform
    ? sources.filter(s => s.platform === selectedPlatform)
    : sources;

  // 处理平台点击
  const handlePlatformClick = (platform: string) => {
    setSelectedPlatform(platform);
    setActiveTab('rooms');
  };

  // 清除平台筛选
  const clearPlatformFilter = () => {
    setSelectedPlatform(null);
  };

  // 初始化加载样式的步骤模型（说明见文件顶部）
  const activeLiveStepIdx = Math.max(
    0,
    WEB_LIVE_LOADING_STEPS.indexOf(loadingStage)
  );
  // 方格/魔法阵不出现 emoji：阶段语义由描边图标承担，文案只留纯中文
  const plainLoadingMessage = loadingMessage
    .replace(/^[^一-龥]+/, '')
    .replace(/[\s.．。]+$/, '');
  // 蒙层只有个布尔量，没有子阶段可跟，固定停在「加载」这一格
  const playerStepIdx = 0;

  // 如果功能未启用，显示提示
  if (isWebLiveEnabled === false) {
    return (
      <PageLayout activePath='/web-live'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <AlertTriangle className='w-12 h-12 text-white' />
                <div className='absolute -inset-2 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl opacity-20 animate-pulse'></div>
              </div>
            </div>

            <div className='space-y-4'>
              <h3 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>功能未启用</h3>
              <div className='bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4'>
                <p className='text-sm text-gray-700 dark:text-gray-300 leading-relaxed'>
                  网络直播功能当前未启用。请联系管理员在管理面板中开启此功能。
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout activePath='/web-live'>
        {/* fixed 铺满视口：main 在移动端有 3rem 顶距和底部安全区，
            用 min-h-screen 会把内容整体压到视口中心偏下 */}
        <div className='mtv-load-overlay fixed inset-0 flex items-center justify-center pointer-events-none'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 三种加载款式（旧版那一套各页自备） */}
            <LoadingStyle
              steps={WEB_LIVE_LOADING_STEPS.map(
                (k) => WEB_LIVE_LOADING_STEP_META[k]
              )}
              activeStepIdx={activeLiveStepIdx}
              message={plainLoadingMessage}
              legacy={
                <>
                  {/* 动画直播图标 */}
                  <div className='relative mb-8'>
                    <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                      <div className='text-white text-4xl'>📺</div>
                      {/* 旋转光环 */}
                      <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                    </div>

                    {/* 浮动粒子效果 */}
                    <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                      <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                      <div
                        className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                        style={{ animationDelay: '0.5s' }}
                      ></div>
                      <div
                        className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                        style={{ animationDelay: '1s' }}
                      ></div>
                    </div>
                  </div>

                  {/* 进度指示器 */}
                  <div className='mb-6 w-80 mx-auto'>
                    <div className='flex justify-center space-x-2 mb-4'>
                      <div
                        className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'loading' ? 'bg-green-500 scale-125' : 'bg-green-500'}`}
                      ></div>
                      <div
                        className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'fetching' ? 'bg-green-500 scale-125' : 'bg-green-500'}`}
                      ></div>
                      <div
                        className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'ready' ? 'bg-green-500 scale-125' : 'bg-gray-300'}`}
                      ></div>
                    </div>

                    {/* 进度条 */}
                    <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden'>
                      <div
                        className='h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out'
                        style={{
                          width: loadingStage === 'loading' ? '33%' : loadingStage === 'fetching' ? '66%' : '100%',
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* 加载消息 */}
                  <div className='space-y-2'>
                    <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
                      {loadingMessage}
                    </p>
                  </div>
                </>
              }
            />
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/web-live'>
      <div className='ptv-live-page apex-live-content f1-web-live-page flex flex-col gap-4'>
        <LiveTabs active='web-live' />
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 max-w-[80%]'>
            <Radio className='w-5 h-5 text-blue-500 flex-shrink-0' />
            <div className='min-w-0 flex-1'>
              <div className='truncate'>
                {currentSource?.name || '网络直播'}
              </div>
            </div>
          </h1>
        </div>

        <div className='space-y-2'>
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() => setIsChannelListCollapsed(!isChannelListCollapsed)}
              className='group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isChannelListCollapsed ? 'rotate-180' : 'rotate-0'}`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7' />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isChannelListCollapsed ? '显示' : '隐藏'}
              </span>
              <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${isChannelListCollapsed ? 'bg-orange-400 animate-pulse' : 'bg-green-400'}`}></div>
            </button>
          </div>

          <div className={`ptv-player-grid ${isChannelListCollapsed ? 'ptv-player-grid-collapsed' : ''}`}>
            <div className='ptv-player-stage'>
              <div className='ptv-player-canvas relative w-full aspect-video' style={currentSource?.platform === 'twitch' ? { minHeight: 300 } : undefined}>
                <div className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30'>
                  {currentSource?.platform === 'twitch' && playback?.embedUrl ? (
                    <TwitchLivePlayer channel={currentSource.roomId} embedUrl={playback.embedUrl} title={streamInfo?.title || currentSource.name} onStatus={handleTwitchStatus} />
                  ) : playback?.kind === 'embed' && playback.embedUrl ? (
                    <iframe key={currentSource?.key + ':' + playback.embedUrl} src={playback.embedUrl} title={streamInfo?.title || currentSource?.name || '直播'} className='h-full w-full border-0' style={currentSource?.platform === 'twitch' ? { minHeight: 300 } : undefined} referrerPolicy='strict-origin-when-cross-origin' allow='autoplay; encrypted-media; fullscreen; picture-in-picture' allowFullScreen />
                  ) : playback?.kind === 'stream' && playback.url && playback.liveStatus !== 'offline' && !errorMessage && !isVideoLoading && (
                    <WebLivePlayer url={variant?.url || playback.url} type={variant?.type || playback.type || 'hls'} onFailure={handlePlaybackFailure} onPlaying={handlePlaying} onBuffering={() => clearTimeout(stablePlaybackTimerRef.current)} />
                  )}
                </div>

                {playback?.liveStatus === 'offline' && !isVideoLoading && !errorMessage && (
                  <div className='ptv-live-offline absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center'>
                    <Radio className='h-8 w-8' aria-hidden />
                    <h3>直播间当前未开播</h3>
                    <p>开播后会自动连接，无需重新添加直播地址。</p>
                    <button type='button' onClick={() => currentSource && handleSourceClick(currentSource)}>立即检查</button>
                  </div>
                )}

                {errorMessage && (
                  <div className='absolute inset-0 bg-black/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30 flex items-center justify-center z-[600] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      {/* 错误图标：跟其他页面失败态同款，遮罩是深色底所以钉暗色 */}
                      <div className='relative mb-4 lg:mb-8'>
                        {/* 三种失败款式（旧版那一套各页自备） */}
                        <LoadingErrorStyle
                          steps={WEB_LIVE_PLAYER_STEPS}
                          activeStepIdx={playerStepIdx}
                          message={errorMessage}
                          onDark
                          legacy={
                            <>
                              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                                <div className='text-white text-4xl'>⚠️</div>
                                <div className='absolute -inset-2 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl opacity-20 animate-pulse'></div>
                              </div>
                            </>
                          }
                        />
                      </div>
                      <div className='space-y-2 lg:space-y-4'>
                        <h3 className='text-xl font-semibold text-white'>{errorCode === 'PLATFORM_RESTRICTED' ? '平台限制了当前访问' : errorCode === 'CUSTOM_URL_EXPIRED' ? '播放地址需要更新' : '暂时无法连接直播'}</h3>
                        <div className='mtv-err-box bg-orange-500/20 border border-orange-500/30 rounded-lg p-4'>
                          <p className='text-orange-300 font-medium'>{errorMessage}</p>
                        </div>
                        {canAutoRetry && <p className='text-xs text-gray-300'>稍后会自动重试，也可以立即检查。</p>}
                        {variant && <p className='text-xs text-gray-300'>也可在播放器下方切换清晰度或播放线路，无需刷新页面。</p>}
                        <button type='button' onClick={() => currentSource && handleSourceClick(currentSource)} className='rounded-lg bg-green-600 px-4 py-2 text-white'>立即检查</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 加载蒙层：常驻挂载，靠透明度淡入淡出；隐藏时不拦截播放器点击 */}
                <div className={`absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30 flex items-center justify-center z-[500] transition-opacity duration-200 ease-[cubic-bezier(.16,1,.3,1)] ${isVideoLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  {isVideoLoading && (
                    <div className='text-center max-w-md mx-auto px-6'>
                      {/* 三种加载款式（旧版那一套各页自备） */}
                      <LoadingStyle
                        steps={WEB_LIVE_PLAYER_STEPS}
                        activeStepIdx={playerStepIdx}
                        message='加载中'
                        onDark
                        legacy={
                          <>
                            <div className='relative mb-8'>
                              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                                <div className='text-white text-4xl'>📺</div>
                                <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                              </div>
                            </div>
                            <div className='space-y-2'>
                              <p className='text-xl font-semibold text-white animate-pulse'>🔄 加载中...</p>
                            </div>
                          </>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              {currentSource && (
                <WebLiveRoomDetails source={currentSource} info={streamInfo} loading={isVideoLoading} error={!!errorMessage} />
              )}
              {playback?.kind === 'stream' && playback.url && playback.liveStatus !== 'offline' && (
                <section className='ptv-live-settings f1-broadcast-console' aria-label='直播画质与线路'>
                  {variant && (
                    <div className='ptv-live-controls'>
                      <label className='ptv-live-field'>
                        <span>清晰度</span>
                        <span className='ptv-live-select'>
                        <select value={qualityName(variant)} onChange={(event) => {
                          const next = chooseVariant(variants, event.target.value, variant.cdn, variant.type);
                          selectVariant(next, next && (next.cdn !== variant.cdn || next.type !== variant.type) ? '该画质没有当前线路或协议，已选择可用选项。' : '');
                        }}>
                          {qualities.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
                        </select>
                        <ChevronDown aria-hidden='true' />
                        </span>
                      </label>
                      {cdns.length > 1 && <label className='ptv-live-field ptv-live-field--route'>
                        <span>播放线路</span>
                        <span className='ptv-live-select'>
                        <select value={variant.cdn || ''} onChange={(event) => {
                          const next = chooseVariant(qualityVariants.filter((item) => (item.cdn || '') === event.target.value), qualityName(variant), event.target.value || undefined, variant.type);
                          selectVariant(next, next && next.type !== variant.type ? '该线路没有当前协议，已选择可用协议。' : '');
                        }}>
                          {cdns.map((cdn, index) => <option key={cdn} value={cdn}>线路 {index + 1}{cdn === 'AL' ? ' · 阿里云' : cdn === 'TX' ? ' · 腾讯云' : cdn.startsWith('ts-') ? ' · HLS' : cdn.startsWith('fmp4-') ? ' · HLS 备用' : cdn.startsWith('flv-') ? ' · FLV' : ''}</option>)}
                        </select>
                        <ChevronDown aria-hidden='true' />
                        </span>
                      </label>}
                      {protocolTypes.length > 1 && (
                        <button type='button' className='ptv-live-advanced-toggle' aria-expanded={showAdvancedPlayback} aria-controls='web-live-advanced' onClick={() => setShowAdvancedPlayback((open) => !open)}>
                          <SlidersHorizontal aria-hidden='true' />高级选项<ChevronDown aria-hidden='true' className='ptv-live-disclosure-arrow' />
                        </button>
                      )}
                    </div>
                  )}
                  {variant && protocolTypes.length > 1 && showAdvancedPlayback && (
                    <div id='web-live-advanced' className='ptv-live-advanced'>
                      <label className='ptv-live-field ptv-live-field--protocol'>
                        <span>播放协议</span>
                        <span className='ptv-live-select'>
                          <select value={variant.type} onChange={(event) => selectVariant(protocols.find((item) => item.type === event.target.value))}>
                            {protocolTypes.map((protocol) => <option key={protocol} value={protocol}>{protocol === 'hls' ? 'HLS · 兼容优先' : 'FLV · 备用协议'}</option>)}
                          </select>
                          <ChevronDown aria-hidden='true' />
                        </span>
                      </label>
                      <p>手机优先选择 HLS；部分移动浏览器无法播放 FLV。</p>
                    </div>
                  )}
                  {selectionNotice && <p className='ptv-live-notice' role='status'><Info aria-hidden='true' />{selectionNotice}</p>}
                  {variant && (
                    <details className='ptv-live-help'>
                      <summary><Info aria-hidden='true' /><span>画质与播放提示</span><ChevronDown aria-hidden='true' className='ptv-live-disclosure-arrow' /></summary>
                      <dl>
                        <div><dt>可选画质</dt><dd>{playback.qualityNote || '当前列表仅显示平台向访客开放的画质。'}</dd></div>
                        {/\d+M/i.test(qualityName(variant)) && <div><dt>码率标识</dt><dd>M 表示平台标注的码率，数值越高，所需带宽越大。</dd></div>}
                        <div><dt>播放卡顿</dt><dd>先降低清晰度；仍不流畅时，再切换播放线路。</dd></div>
                      </dl>
                    </details>
                  )}
                </section>
              )}

              {/* 外部播放器按钮 */}
              {currentSource && playback?.kind === 'stream' && originalVideoUrl && !webLiveSync.isInRoom && (
                <div className='ptv-room-tools'>
                  <span className='ptv-room-tools-label'>外部播放</span>
                  <div className='min-w-0 overflow-x-auto'>
                    <div className='flex w-max items-center gap-1.5'>
                      {/* 网页播放 */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const roomUrl = getRoomUrl(currentSource);
                          if (roomUrl) {
                            window.open(roomUrl, '_blank');
                          }
                        }}
                        className='group relative flex items-center justify-center gap-1 w-8 h-8 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0'
                        title='网页播放'
                      >
                        <svg
                          className='w-4 h-4 flex-shrink-0 text-gray-700 dark:text-gray-200'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                          xmlns='http://www.w3.org/2000/svg'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25'
                          />
                        </svg>
                        <span className='hidden lg:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-gray-700 dark:text-gray-200'>
                          网页播放
                        </span>
                      </button>

                      {/* PotPlayer */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (originalVideoUrl) {
                            window.open(`potplayer://${originalVideoUrl}`, '_blank');
                          }
                        }}
                        className='group relative flex items-center justify-center gap-1 w-8 h-8 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0'
                        title='PotPlayer'
                      >
                        <img
                          src='/players/potplayer.png'
                          alt='PotPlayer'
                          className='w-4 h-4 flex-shrink-0'
                        />
                        <span className='hidden lg:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-gray-700 dark:text-gray-200'>
                          PotPlayer
                        </span>
                      </button>

                      {/* VLC */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (originalVideoUrl) {
                            window.open(`vlc://${originalVideoUrl}`, '_blank');
                          }
                        }}
                        className='group relative flex items-center justify-center gap-1 w-8 h-8 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0'
                        title='VLC'
                      >
                        <img
                          src='/players/vlc.png'
                          alt='VLC'
                          className='w-4 h-4 flex-shrink-0'
                        />
                        <span className='hidden lg:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-gray-700 dark:text-gray-200'>
                          VLC
                        </span>
                      </button>

                      {/* MPV */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (originalVideoUrl) {
                            window.open(`mpv://${originalVideoUrl}`, '_blank');
                          }
                        }}
                        className='group relative flex items-center justify-center gap-1 w-8 h-8 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0'
                        title='MPV'
                      >
                        <img
                          src='/players/mpv.png'
                          alt='MPV'
                          className='w-4 h-4 flex-shrink-0'
                        />
                        <span className='hidden lg:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-gray-700 dark:text-gray-200'>
                          MPV
                        </span>
                      </button>

                      {/* MX Player */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (originalVideoUrl) {
                            window.open(
                              `intent://${originalVideoUrl}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(
                                currentSource?.name || '直播'
                              )};end`,
                              '_blank'
                            );
                          }
                        }}
                        className='group relative flex items-center justify-center gap-1 w-8 h-8 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0'
                        title='MX Player'
                      >
                        <img
                          src='/players/mxplayer.png'
                          alt='MX Player'
                          className='w-4 h-4 flex-shrink-0'
                        />
                        <span className='hidden lg:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-gray-700 dark:text-gray-200'>
                          MX Player
                        </span>
                      </button>

                      {/* nPlayer */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (originalVideoUrl) {
                            window.open(`nplayer-${originalVideoUrl}`, '_blank');
                          }
                        }}
                        className='group relative flex items-center justify-center gap-1 w-8 h-8 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0'
                        title='nPlayer'
                      >
                        <img
                          src='/players/nplayer.png'
                          alt='nPlayer'
                          className='w-4 h-4 flex-shrink-0'
                        />
                        <span className='hidden lg:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-gray-700 dark:text-gray-200'>
                          nPlayer
                        </span>
                      </button>

                      {/* IINA */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (originalVideoUrl) {
                            window.open(
                              `iina://weblink?url=${encodeURIComponent(originalVideoUrl)}`,
                              '_blank'
                            );
                          }
                        }}
                        className='group relative flex items-center justify-center gap-1 w-8 h-8 lg:w-auto lg:h-auto lg:px-2 lg:py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0'
                        title='IINA'
                      >
                        <img
                          src='/players/iina.png'
                          alt='IINA'
                          className='w-4 h-4 flex-shrink-0'
                        />
                        <span className='hidden lg:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-gray-700 dark:text-gray-200'>
                          IINA
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className='ptv-player-panel f1-room-panel overflow-hidden'>
              <div className='px-4 py-0 h-full flex flex-col overflow-hidden'>
                <div className='flex mb-1 -mx-6 flex-shrink-0'>
                  <div
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium ${activeTab === 'rooms' ? 'text-green-600 dark:text-green-400' : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'}`}
                  >
                    房间
                  </div>
                  <div
                    onClick={() => setActiveTab('platforms')}
                    className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium ${activeTab === 'platforms' ? 'text-green-600 dark:text-green-400' : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'}`}
                  >
                    平台
                  </div>
                </div>

                {activeTab === 'rooms' && (
                  <div className='ptv-content-in flex-1 overflow-y-auto space-y-2 pb-4 mt-4'>
                    {selectedPlatform && (
                      <div className='mb-3 flex items-center justify-between px-2 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
                        <div className='flex items-center gap-2'>
                          <span className='text-xs text-green-700 dark:text-green-300'>筛选平台:</span>
                          <span className='text-sm font-medium text-green-800 dark:text-green-200'>
                            {webLivePlatformName(selectedPlatform)}
                          </span>
                        </div>
                        <button
                          onClick={clearPlatformFilter}
                          className='text-xs text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 underline'
                        >
                          清除筛选
                        </button>
                      </div>
                    )}
                    {sourcesError ? (
                      <p role='alert' className='px-2 py-4 text-sm text-red-600 dark:text-red-400'>{sourcesError}</p>
                    ) : filteredSources.length > 0 ? (
                      filteredSources.map((source) => {
                        const isActive = source.key === currentSource?.key;
                        return (
                          <button
                            key={source.key}
                            onClick={() => handleSourceClick(source)}
                            disabled={webLiveSync.shouldDisableControls}
                            className={`w-full p-3 rounded-lg text-left active:scale-[0.97] transition-[transform,background-color,color,border-color] duration-150 ${isActive ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} ${webLiveSync.shouldDisableControls ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className='flex items-center gap-3'>
                              <WebLiveAvatar avatar={isActive ? streamInfo?.avatar || source.avatar : source.avatar} cover={isActive ? streamInfo?.cover || source.cover : source.cover} />
                              <div className='flex-1 min-w-0'>
                                <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>{source.name}</div>
                                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>{webLiveSourceLabel(source)}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className='flex flex-col items-center justify-center py-12 text-center'>
                        <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                          <Radio className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                        </div>
                        <p className='text-gray-500 dark:text-gray-400 font-medium'>
                          {selectedPlatform ? '该平台暂无可用房间' : '暂无可用房间'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'platforms' && (
                  <div className='ptv-content-in flex flex-col h-full mt-4'>
                    <div className='flex-1 overflow-y-auto space-y-2 pb-20'>
                      {platforms.length > 0 ? (
                        platforms.map((platform) => (
                          <button
                            key={platform}
                            onClick={() => handlePlatformClick(platform)}
                            disabled={webLiveSync.shouldDisableControls}
                            className={`w-full flex items-start gap-3 px-2 py-3 rounded-lg bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300/50 dark:hover:bg-white/20 active:scale-[0.97] transition-[transform,background-color,color,border-color] duration-150 cursor-pointer ${webLiveSync.shouldDisableControls ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className='w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'>
                              <WebLivePlatformIcon platform={platform} />
                            </div>
                            <div className='flex-1 min-w-0 text-left'>
                              <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                                {webLivePlatformName(platform)}
                              </div>
                              <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                                {sources.filter(s => s.platform === platform).length} 个房间
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className='flex flex-col items-center justify-center py-12 text-center'>
                          <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                            <Radio className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                          </div>
                          <p className='text-gray-500 dark:text-gray-400 font-medium'>暂无可用平台</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
