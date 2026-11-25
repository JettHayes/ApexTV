'use client';

import { Compass, Flame, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatAppError, reportAppError, requestJson } from '@/lib/app-error';
import {
  deleteMangaShelf,
  getAllMangaShelf,
  saveMangaShelf,
} from '@/lib/db.client';
import {
  MangaRecommendResult,
  MangaRecommendType,
  MangaSearchItem,
  MangaShelfItem,
  MangaSource,
} from '@/lib/manga.types';

import { mangaCardItem } from '@/components/media/adapters';
import EmptyState from '@/components/media/EmptyState';
import MediaCard from '@/components/media/MediaCard';
import MediaGrid from '@/components/media/MediaGrid';
import MediaGridSkeleton from '@/components/media/MediaGridSkeleton';
import MediaSectionHeader from '@/components/media/MediaSectionHeader';
import ShelfChipButton from '@/components/media/ShelfChipButton';
import ProxyImage from '@/components/ProxyImage';

/** 书墙：比通用网格更密，一眼看过去全是封面。 */
const WALL_CLASS =
  'grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8';

function buildDetailHref(item: {
  id: string;
  sourceId: string;
  title: string;
  cover: string;
  sourceName: string;
  returnTo: string;
}) {
  const params = new URLSearchParams({
    mangaId: item.id,
    sourceId: item.sourceId,
    title: item.title,
    cover: item.cover,
    sourceName: item.sourceName,
    returnTo: item.returnTo,
  });
  return `/manga/detail?${params.toString()}`;
}

export default function MangaRecommendPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<MangaSource[]>([]);
  // 书源还没回来时 sourceId 必然是空的——这段时间必须显示加载指示，
  // 否则会先闪一下"没有漫画源"的占位，而我们其实只是还没问完。
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [displayType, setDisplayType] = useState<MangaRecommendType>('POPULAR');
  const recommendRequestRef = useRef(0);
  const recommendAbortRef = useRef<AbortController | null>(null);
  const [sourceId, setSourceId] = useState('');
  // 推荐请求是否已经有结果。没有它的话，"sourceId 已设但请求还没发出去"的那一帧
  // 会先渲染成空态占位，然后又跳成骨架屏。
  const [recommendSettled, setRecommendSettled] = useState(false);
  const [recommendType, setRecommendType] =
    useState<MangaRecommendType>('POPULAR');
  const [result, setResult] = useState<MangaRecommendResult>({
    mangas: [],
    hasNextPage: false,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [shelf, setShelf] = useState<Record<string, MangaShelfItem>>({});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const enabled = (
      window as Window & { RUNTIME_CONFIG?: { SUWAYOMI_ENABLED?: boolean } }
    ).RUNTIME_CONFIG?.SUWAYOMI_ENABLED;
    if (!enabled) {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    const query = searchParams.get('q')?.trim();
    if (!query) return;

    const params = new URLSearchParams(searchParams.toString());
    router.replace(`/manga/search?${params.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    requestJson<{ sources: MangaSource[] }>('/api/manga/sources', undefined, '加载漫画源')
      .then((data) => {
        const nextSources = data.sources || [];
        setSources(nextSources);
        setSourceId((prev) => prev || nextSources[0]?.id || '');
      })
      .catch((err) => { reportAppError(err, '加载漫画源'); setError(formatAppError(err, '加载漫画源')); })
      .finally(() => setSourcesLoading(false));

    getAllMangaShelf()
      .then(setShelf)
      .catch(() => undefined);
  }, []);

  const fetchRecommend = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!sourceId) return;

      const requestId = ++recommendRequestRef.current;
      recommendAbortRef.current?.abort();
      const controller = new AbortController();
      recommendAbortRef.current = controller;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError('');
      }

      try {
        const params = new URLSearchParams({
          sourceId,
          type: recommendType,
          page: String(nextPage),
        });
        const data = await requestJson<MangaRecommendResult>(`/api/manga/recommend?${params.toString()}`, {
          signal: controller.signal,
        }, '加载漫画推荐');
        if (requestId !== recommendRequestRef.current) return;

        setDisplayType(recommendType);
        if (!append) setFeaturedIndex(0);
        setPage(nextPage);
        setResult((prev) => ({
          mangas: append ? [...prev.mangas, ...data.mangas] : data.mangas,
          hasNextPage: data.hasNextPage,
        }));
      } catch (err) {
        if (
          controller.signal.aborted ||
          requestId !== recommendRequestRef.current
        )
          return;
        reportAppError(err, '加载漫画推荐'); setError(formatAppError(err, '加载漫画推荐'));
        if (!append) {
          setResult({ mangas: [], hasNextPage: false });
        }
      } finally {
        if (
          requestId === recommendRequestRef.current &&
          !controller.signal.aborted
        ) {
          setLoading(false);
          setLoadingMore(false);
          if (!append) setRecommendSettled(true);
        }
      }
    },
    [recommendType, sourceId]
  );

  useEffect(() => {
    if (!sourceId) return;
    setRecommendSettled(false);
    void fetchRecommend(1, false);
    return () => recommendAbortRef.current?.abort();
  }, [fetchRecommend, sourceId]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || loading || loadingMore || !result.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          !entry?.isIntersecting ||
          loadingMore ||
          loading ||
          !result.hasNextPage
        )
          return;
        void fetchRecommend(page + 1, true);
      },
      {
        rootMargin: '240px 0px',
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchRecommend, loading, loadingMore, page, result.hasNextPage]);

  const recommendOptions = useMemo(
    () => [
      {
        label: '热门',
        value: 'POPULAR',
        icon: <Flame className='h-3.5 w-3.5' />,
      },
      {
        label: '最新',
        value: 'LATEST',
        icon: <Sparkles className='h-3.5 w-3.5' />,
      },
    ],
    []
  );

  const toggleShelf = async (item: MangaSearchItem) => {
    const key = `${item.sourceId}+${item.id}`;
    if (shelf[key]) {
      await deleteMangaShelf(item.sourceId, item.id);
      setShelf((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    const shelfItem: MangaShelfItem = {
      title: item.title,
      cover: item.cover,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      mangaId: item.id,
      saveTime: Date.now(),
      description: item.description,
      author: item.author,
      status: item.status,
    };
    await saveMangaShelf(item.sourceId, item.id, shelfItem);
    setShelf((prev) => ({ ...prev, [key]: shelfItem }));
  };

  const badge = displayType === 'POPULAR' ? '热门' : '最新';

  // 首屏：书源还在路上，或已经有源但推荐请求还没落定——都还没到能断言"没有内容"的时候。
  const booting =
    sourcesLoading ||
    (result.mangas.length === 0 &&
      (loading || (Boolean(sourceId) && !recommendSettled)));

  return (
    <div className='f1-reading-discover f1-comic-discover f1-manga-reference-workspace'>
      <div className='f1-manga-reference-main space-y-8' aria-busy={loading}>
        {sources.length > 0 ? (
          <section
            id='manga-sources'
            className='f1-comic-browser f1-manga-discovery-filters'
            aria-label='漫画来源与排序'
          >
            <label className='f1-manga-source-control'>
              <span>漫画来源</span>
              <select
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.displayName || source.name}
                  </option>
                ))}
              </select>
            </label>
            <div className='f1-manga-sort-control' aria-label='推荐排序'>
              {recommendOptions.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  aria-pressed={recommendType === option.value}
                  onClick={() =>
                    setRecommendType(option.value as MangaRecommendType)
                  }
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!booting &&
          !error &&
          result.mangas[0] &&
          (() => {
            const item =
              result.mangas[featuredIndex % Math.min(result.mangas.length, 5)];
            const href = buildDetailHref({
              id: item.id,
              sourceId: item.sourceId,
              title: item.title,
              cover: item.cover,
              sourceName: item.sourceName,
              returnTo: '/manga',
            });
            return (
              <section id='manga-featured' className='f1-manga-reference-hero'>
                {item.cover && <ProxyImage originalSrc={item.cover} alt='' />}
                <div className='f1-manga-reference-hero-copy'>
                  <span>{badge}</span>
                  <h2>{item.title}</h2>
                  {item.description && <p>{item.description}</p>}
                  <button type='button' onClick={() => router.push(href)}>
                    查看详情
                  </button>
                </div>
                {result.mangas.length > 1 && (
                  <>
                    <button
                      type='button'
                      className='f1-manga-hero-next'
                      aria-label='下一本主推漫画'
                      onClick={() =>
                        setFeaturedIndex(
                          (index) =>
                            (index + 1) % Math.min(result.mangas.length, 5)
                        )
                      }
                    >
                      ›
                    </button>
                    <div className='f1-manga-hero-dots'>
                      {result.mangas.slice(0, 5).map((manga, index) => (
                        <button
                          type='button'
                          key={manga.sourceId + manga.id}
                          aria-label={'展示第 ' + (index + 1) + ' 本漫画'}
                          aria-pressed={
                            index ===
                            featuredIndex % Math.min(result.mangas.length, 5)
                          }
                          onClick={() => setFeaturedIndex(index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            );
          })()}

        <section className='f1-comic-catalog space-y-4'>
          <MediaSectionHeader
            title={displayType === 'POPULAR' ? '热门漫画' : '最新更新'}
          />

          {error ? (
            <div>
              <EmptyState tone='error' description={error} />
              <button
                type='button'
                className='f1-manga-retry'
                onClick={() => void fetchRecommend(1, false)}
              >
                重试
              </button>
            </div>
          ) : booting ? (
            <MediaGridSkeleton count={18} className={WALL_CLASS} />
          ) : result.mangas.length === 0 ? (
            <EmptyState
              icon={<Compass className='h-7 w-7' />}
              title={sourceId ? '这个源暂时没有推荐' : '还没有可用的漫画源'}
              description={
                sourceId
                  ? '换一个漫画源，或稍后再试。'
                  : '在管理端配置 Suwayomi 漫画源后即可在这里浏览。'
              }
            />
          ) : (
            <>
              <MediaGrid className={WALL_CLASS}>
                {result.mangas.map((item) => {
                  const key = `${item.sourceId}+${item.id}`;
                  return (
                    <MediaCard
                      key={key}
                      item={{
                        // 墙上的书只留封面与书名：排序已在标题里说明，逐张挂"热门"角标
                        // 在 8 列书墙上只是噪音。
                        ...mangaCardItem(item),
                        badge: undefined,
                      }}
                      href={buildDetailHref({
                        id: item.id,
                        sourceId: item.sourceId,
                        title: item.title,
                        cover: item.cover,
                        sourceName: item.sourceName,
                        returnTo: '/manga',
                      })}
                      overlayAction={
                        <ShelfChipButton
                          active={Boolean(shelf[key])}
                          onClick={() => toggleShelf(item)}
                        />
                      }
                    />
                  );
                })}
              </MediaGrid>

              <div
                ref={loadMoreRef}
                className='flex min-h-10 items-center justify-center text-sm text-library-muted dark:text-library-night-muted'
              >
                {loadingMore
                  ? '正在加载更多...'
                  : result.hasNextPage
                  ? '继续下滑加载更多'
                  : '没有更多了'}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
