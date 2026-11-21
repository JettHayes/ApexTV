'use client';

import { BookX, Compass, Loader2, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  BookCatalogResult,
  BookListItem,
  BookSource,
} from '@/lib/book.types';
import {
  buildBookDetailPath,
  cacheBookListItem,
} from '@/lib/book-route-cache.client';
import { cn } from '@/lib/cn';

import BooksPagination from '@/components/books/BooksPagination';
import { bookCardItem } from '@/components/media/adapters';
import EmptyState from '@/components/media/EmptyState';
import {
  LIBRARY_FIELD,
  LIBRARY_GHOST_BUTTON,
  LIBRARY_MUTED,
  LIBRARY_SERIF,
  LIBRARY_TEXT,
  SPINE_TAB,
  SPINE_TAB_ACTIVE,
  SPINE_TAB_IDLE,
} from '@/components/media/library';
import MediaCard from '@/components/media/MediaCard';
import MediaGrid from '@/components/media/MediaGrid';
import MediaGridSkeleton from '@/components/media/MediaGridSkeleton';

const PAGE_SIZE = 48;

export default function BooksCatalogPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sourceId = params.get('sourceId') || '';
  const href = params.get('href') || '';
  const [sources, setSources] = useState<BookSource[]>([]);
  const [filter, setFilter] = useState('');
  const [data, setData] = useState<BookCatalogResult | null>(null);
  const [navigation, setNavigation] = useState<BookCatalogResult['navigation']>(
    []
  );
  const [navigationSource, setNavigationSource] = useState('');
  const [entries, setEntries] = useState<BookListItem[]>([]);
  const [nextHref, setNextHref] = useState<string>();
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const busyMore = useRef(false);
  const loaded = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const loader = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/books/sources', { signal: abort.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error('书源列表加载失败');
        return json;
      })
      .then((json) => setSources(json.sources || []))
      .catch(() => {
        if (!abort.signal.aborted)
          setSourceError('书源列表加载失败，可返回发现页重试。');
      });
    return () => abort.abort();
  }, []);

  const loadCatalog = useCallback(
    async (target = '', append = false) => {
      if (
        !sourceId ||
        (append && (busyMore.current || loaded.current.has(target)))
      )
        return;
      if (!append) {
        active.current?.abort();
        active.current = new AbortController();
        generation.current += 1;
        busyMore.current = false;
        loaded.current = new Set();
        failed.current = new Set();
        setEntries([]);
        setNextHref(undefined);
        setLoading(true);
        setPage(1);
      }
      const abort = active.current;
      if (!abort) return;
      const id = generation.current;
      if (append) {
        busyMore.current = true;
        setLoadingMore(true);
      }
      setError('');
      try {
        const query = new URLSearchParams({ sourceId });
        if (target) query.set('href', target);
        const res = await fetch('/api/books/catalog?' + query, {
          signal: abort.signal,
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.code === 'CATALOG_SOURCE_MISMATCH') {
            if (id === generation.current && !abort.signal.aborted)
              router.replace(
                '/books/catalog?' + new URLSearchParams({ sourceId })
              );
            return;
          }
          if (
            json.upstreamStatus === 403 ||
            /请求失败[:：]?\s*403/.test(json.error || '')
          ) {
            throw new Error(
              '书源网站拒绝了服务器访问（403）。此书源可能需要验证或限制了访问地区，可以换一个书源。'
            );
          }
          throw new Error(json.error || '目录加载失败');
        }
        if (id !== generation.current || abort.signal.aborted) return;
        const result = json as BookCatalogResult;
        loaded.current.add(target);
        setData(result);
        if (!target) {
          setNavigation(result.navigation || []);
          setNavigationSource(sourceId);
        }
        setEntries((previous) => {
          const combined = append
            ? [...previous, ...(result.entries || [])]
            : result.entries || [];
          const seen = new Set<string>();
          return combined.filter((item) => {
            const key = item.sourceId + '|' + item.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        setNextHref(result.nextHref);
      } catch (cause) {
        if (id !== generation.current || abort.signal.aborted) return;
        if (append) failed.current.add(target);
        setError(cause instanceof Error ? cause.message : '目录加载失败');
      } finally {
        if (id === generation.current) {
          setLoading(false);
          setLoadingMore(false);
          busyMore.current = false;
        }
      }
    },
    [sourceId, router]
  );

  useEffect(() => {
    setNavigation([]);
    setNavigationSource('');
    setData(null);
  }, [sourceId]);

  useEffect(() => {
    if (sourceId) void loadCatalog(href);
    return () => {
      active.current?.abort();
      generation.current += 1;
    };
  }, [sourceId, href, loadCatalog]);

  useEffect(() => {
    if (!sourceId || !href || navigationSource === sourceId) return;
    const abort = new AbortController();
    fetch('/api/books/catalog?' + new URLSearchParams({ sourceId }), {
      signal: abort.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (json && !abort.signal.aborted) {
          setNavigation(json.navigation || []);
          setNavigationSource(sourceId);
        }
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [sourceId, href, navigationSource]);

  const navigationItems = useMemo(() => {
    if (navigationSource !== sourceId) return [];
    const seen = new Set<string>();
    return navigation.filter((item) => {
      if (
        !item.href ||
        !item.title?.trim() ||
        item.title === '目录' ||
        ['next', 'previous'].includes(item.rel || '') ||
        seen.has(item.href)
      )
        return false;
      seen.add(item.href);
      return true;
    });
  }, [navigation, navigationSource, sourceId]);

  useEffect(() => {
    // A navigation-only feed needs a category. Acquisition feeds already have
    // books at the root and must not be redirected away from those books.
    if (
      !href &&
      data &&
      data.sourceId === sourceId &&
      !entries.length &&
      !loading &&
      !error &&
      navigationItems[0]?.href
    ) {
      router.replace(
        '/books/catalog?' +
          new URLSearchParams({ sourceId, href: navigationItems[0].href })
      );
    }
  }, [
    sourceId,
    href,
    data,
    entries.length,
    loading,
    error,
    navigationItems,
    router,
  ]);

  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  useEffect(() => {
    if (
      !loader.current ||
      !nextHref ||
      loading ||
      loadingMore ||
      error ||
      currentPage !== pages ||
      failed.current.has(nextHref)
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadCatalog(nextHref, true);
      },
      { rootMargin: '160px 0px' }
    );
    observer.observe(loader.current);
    return () => observer.disconnect();
  }, [nextHref, loading, loadingMore, error, currentPage, pages, loadCatalog]);

  const selected = sources.find((source) => source.id === sourceId);
  const visibleSources = sources.filter(
    (source) =>
      source.id === sourceId ||
      (source.capabilities?.catalogSupported &&
        source.name.toLowerCase().includes(filter.trim().toLowerCase()))
  );
  const navigate = (nextSource: string, nextHref = '') => {
    setError('');
    const query = new URLSearchParams({ sourceId: nextSource });
    if (nextHref) query.set('href', nextHref);
    router.push('/books/catalog?' + query);
  };

  return (
    <div className='f1-reading-catalog space-y-6'>
      <section className='f1-catalog-tools border-b border-library-edge pb-5 dark:border-library-night-edge'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className={cn('text-xs', LIBRARY_MUTED)}>浏览目录</p>
            <h1
              className={cn(
                'mt-1 break-words text-xl font-semibold sm:text-2xl',
                LIBRARY_TEXT,
                LIBRARY_SERIF
              )}
            >
              {selected?.name || data?.sourceName || '选择书源'}
            </h1>
          </div>
          {sourceId && (
            <Link
              prefetch={false}
              href={'/books/search?' + new URLSearchParams({ sourceId })}
              className={LIBRARY_GHOST_BUTTON}
            >
              <Search className='h-4 w-4' />
              搜索此书源
            </Link>
          )}
        </div>
        <div className='mt-4 grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_2fr]'>
          <label>
            <span className={cn('mb-2 block text-xs', LIBRARY_MUTED)}>
              查找书源
            </span>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label='筛选目录书源'
              placeholder='按名称筛选'
              className={cn(LIBRARY_FIELD, 'min-h-11 text-base')}
            />
          </label>
          <label className='min-w-0'>
            <span className={cn('mb-2 block text-xs', LIBRARY_MUTED)}>
              切换书源
            </span>
            <select
              value={sourceId}
              aria-label='切换目录书源'
              onChange={(event) => navigate(event.target.value)}
              className={cn(LIBRARY_FIELD, 'min-h-11 truncate text-base')}
            >
              <option value=''>请选择书源</option>
              {sourceId && !selected && (
                <option value={sourceId}>
                  {data?.sourceName || '当前书源'}
                </option>
              )}
              {visibleSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {sourceError && (
          <p className={cn('mt-2 text-xs', LIBRARY_MUTED)}>{sourceError}</p>
        )}
      </section>

      {navigationItems.length > 0 &&
        (navigationItems.length > 12 ? (
          <label className='block sm:max-w-sm'>
            <span className={cn('mb-2 block text-xs', LIBRARY_MUTED)}>
              分类
            </span>
            <select
              aria-label='切换书籍分类'
              value={href}
              onChange={(event) => navigate(sourceId, event.target.value)}
              className={cn(LIBRARY_FIELD, 'min-h-11 text-base')}
            >
              <option value=''>全部目录</option>
              {navigationItems.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <nav
            aria-label='书籍分类'
            className='flex gap-1 overflow-x-auto border-b border-library-edge pb-px dark:border-library-night-edge'
          >
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                prefetch={false}
                href={
                  '/books/catalog?' +
                  new URLSearchParams({ sourceId, href: item.href })
                }
                aria-current={item.href === href ? 'page' : undefined}
                className={cn(
                  SPINE_TAB,
                  'min-h-11',
                  item.href === href ? SPINE_TAB_ACTIVE : SPINE_TAB_IDLE
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        ))}

      {!sourceId ? (
        <EmptyState
          icon={<Compass className='h-6 w-6' />}
          title='选择一个书源开始浏览'
          description='在上方切换书源，或回到发现页查找。'
          action={
            <Link href='/books' className={LIBRARY_GHOST_BUTTON}>
              回到发现页
            </Link>
          }
        />
      ) : (
        <>
          {error && (
            <div
              role='alert'
              className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
            >
              <p className='min-w-0 flex-1 basis-56 break-words leading-relaxed'>
                {error}
              </p>
              <button
                type='button'
                onClick={() =>
                  void loadCatalog(
                    entries.length && nextHref ? nextHref : href,
                    !!entries.length && !!nextHref
                  )
                }
                className={cn(LIBRARY_GHOST_BUTTON, 'min-h-11')}
              >
                <RefreshCw className='h-4 w-4' />
                重试
              </button>
            </div>
          )}
          {loading ? (
            <MediaGridSkeleton count={6} />
          ) : entries.length > 0 ? (
            <>
              <p className={cn('text-xs tabular-nums', LIBRARY_MUTED)}>
                已加载 {entries.length} 本{nextHref ? ' · 还有后续页面' : ''}
              </p>
              <MediaGrid className='sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'>
                {entries
                  .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  .map((item) => (
                    <MediaCard
                      key={item.sourceId + '-' + item.id}
                      item={bookCardItem(item)}
                      href={buildBookDetailPath(item.sourceId, item.id)}
                      onNavigate={() => cacheBookListItem(item)}
                    />
                  ))}
              </MediaGrid>
              <BooksPagination
                page={currentPage}
                total={entries.length}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          ) : !error && data && !navigationItems.length ? (
            <EmptyState
              icon={<BookX className='h-6 w-6' />}
              title='当前目录没有书籍'
              description='可以切换分类，或搜索这个书源。'
            />
          ) : null}
          {nextHref && currentPage === pages && (
            <div ref={loader} className='flex justify-center py-4'>
              <button
                type='button'
                disabled={loadingMore}
                onClick={() => void loadCatalog(nextHref, true)}
                className={cn(LIBRARY_GHOST_BUTTON, 'min-h-11')}
              >
                {loadingMore && (
                  <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' />
                )}
                {loadingMore ? '正在加载后续页面' : '加载更多'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
