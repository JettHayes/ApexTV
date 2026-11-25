'use client';

import {
  AlertCircle,
  ArrowDown,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppRequestError, formatAppError, reportAppError } from '@/lib/app-error';
import type {
  BookListItem,
  BookSearchFailure,
  BookSource,
} from '@/lib/book.types';
import {
  buildBookDetailPath,
  cacheBookListItem,
} from '@/lib/book-route-cache.client';
import {
  type BookSearchPlanSummary,
  fetchBookSearchPlan,
  traverseBookSearchBatches,
} from '@/lib/book-search.client';
import {
  buildBookSourceOptions,
  filterBookSourceOptions,
} from '@/lib/book-source-display';
import { cn } from '@/lib/cn';

import BooksPagination from '@/components/books/BooksPagination';
import { bookCardItem } from '@/components/media/adapters';
import EmptyState from '@/components/media/EmptyState';
import {
  LIBRARY_BUTTON,
  LIBRARY_FIELD,
  LIBRARY_FOCUS,
  LIBRARY_GHOST_BUTTON,
  LIBRARY_MUTED,
  LIBRARY_PANEL,
  LIBRARY_SERIF,
  LIBRARY_TEXT,
} from '@/components/media/library';
import MediaCard from '@/components/media/MediaCard';
import MediaGrid from '@/components/media/MediaGrid';
import MediaGridSkeleton from '@/components/media/MediaGridSkeleton';

type SearchStatus = 'idle' | 'running' | 'complete' | 'stopped' | 'error';
type SearchView = {
  keyword: string;
  scope: string;
  mode: 'quick' | 'deep';
  status: SearchStatus;
  results: BookListItem[];
  failures: BookSearchFailure[];
  completed: number;
  plan: BookSearchPlanSummary | null;
  error: string;
  quickRevision?: string;
};
const EMPTY_VIEW: SearchView = {
  keyword: '',
  scope: '',
  mode: 'quick',
  status: 'idle',
  results: [],
  failures: [],
  completed: 0,
  plan: null,
  error: '',
};
const STATE_KEY = 'apex_book_search_v3';
const CACHE_MS = 10 * 60 * 1000;
const PAGE_SIZE = 48;
const QUICK_SEARCHES = ['三体', '刘慈欣', '东野圭吾', '哈利波特'];

function readState(): (SearchView & { savedAt: number }) | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    return saved &&
      Date.now() - saved.savedAt < CACHE_MS &&
      Array.isArray(saved.results)
      ? saved
      : null;
  } catch {
    return null;
  }
}
function saveState(view: SearchView) {
  if (view.status === 'idle' || view.status === 'running') return;
  try {
    const json = JSON.stringify({ ...view, savedAt: Date.now() });
    if (json.length <= 2 * 1024 * 1024) sessionStorage.setItem(STATE_KEY, json);
  } catch {
    /* Storage may be unavailable or full. */
  }
}
function fluidSearchEnabled() {
  try {
    const saved = localStorage.getItem('fluidSearch');
    if (saved !== null) return JSON.parse(saved) !== false;
  } catch {
    /* Use the site preference if browser storage is unavailable. */
  }
  return (
    (window as Window & { RUNTIME_CONFIG?: { FLUID_SEARCH?: boolean } })
      .RUNTIME_CONFIG?.FLUID_SEARCH !== false
  );
}

export default function BooksSearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get('q') || '';
  const urlSource = params.get('sourceId') || '';
  const [q, setQ] = useState(urlQuery);
  const [sourceId, setSourceId] = useState(urlSource);
  const [sources, setSources] = useState<BookSource[]>([]);
  const [sourceError, setSourceError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [view, setView] = useState<SearchView>(EMPTY_VIEW);
  const [page, setPage] = useState(1);
  const viewRef = useRef(view);
  const generation = useRef(0);
  const active = useRef<{ abort: AbortController; flush: () => void } | null>(
    null
  );
  const restored = useRef(false);
  const forceNext = useRef(false);
  const loading = view.status === 'running';

  const publish = useCallback((next: SearchView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const beginSearch = useCallback(
    async (
      keyword: string,
      scope: string,
      options: { deep?: boolean; force?: boolean } = {}
    ) => {
      active.current?.abort.abort();
      const id = ++generation.current;
      const abort = new AbortController();
      active.current = { abort, flush: () => undefined };
      const mode = options.deep ? 'deep' : 'quick';
      let current: SearchView = {
        ...EMPTY_VIEW,
        keyword,
        scope,
        mode,
        status: 'running',
        results: options.deep ? viewRef.current.results : [],
        quickRevision: options.deep
          ? viewRef.current.quickRevision || viewRef.current.plan?.revision
          : undefined,
      };
      const results = new Map(
        current.results.map((item) => [item.sourceId + '|' + item.id, item])
      );
      const failures = new Map<string, BookSearchFailure>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const flush = () => {
        clearTimeout(timer);
        timer = undefined;
        current = {
          ...current,
          results: Array.from(results.values()),
          failures: Array.from(failures.values()),
        };
        if (id === generation.current) publish(current);
      };
      const schedule = () => {
        if (!timer) timer = setTimeout(flush, 80);
      };
      active.current.flush = flush;
      publish(current);
      if (!options.deep) setPage(1);
      const searchParams = new URLSearchParams({ mode });
      if (scope) searchParams.set('sourceId', scope);
      try {
        const plan = await fetchBookSearchPlan(searchParams, abort.signal);
        if (id !== generation.current) return;
        current = { ...current, plan };
        flush();
        const saved = options.force || options.deep ? null : readState();
        if (
          saved?.status === 'complete' &&
          saved.keyword === keyword &&
          saved.scope === scope &&
          (saved.mode === 'deep'
            ? saved.quickRevision
            : saved.plan?.revision) === plan.revision
        ) {
          publish(saved);
          return;
        }
        const streaming = fluidSearchEnabled();
        searchParams.set('q', keyword);
        if (options.force) searchParams.set('refresh', '1');
        await traverseBookSearchBatches(
          plan,
          searchParams,
          abort.signal,
          streaming,
          (payload, offset) => {
            if (id !== generation.current || abort.signal.aborted) return;
            for (const item of payload.results || [])
              results.set(item.sourceId + '|' + item.id, item);
            if (payload.type === 'source_error' && payload.sourceId)
              failures.set(payload.sourceId, {
                sourceId: payload.sourceId,
                sourceName: payload.sourceName || '书源',
                error: payload.error || '搜索失败',
                timedOut: payload.timedOut,
              });
            for (const failure of payload.failedSources || [])
              failures.set(failure.sourceId, failure);
            if (typeof payload.completedSources === 'number')
              current = {
                ...current,
                completed: Math.min(
                  plan.totalSources,
                  offset + payload.completedSources
                ),
              };
            if (payload.type !== 'heartbeat') schedule();
          }
        );
        if (abort.signal.aborted || id !== generation.current) return;
        current = { ...current, status: 'complete' };
        flush();
        saveState(current);
      } catch (error) {
        if (id !== generation.current) return;
        if (!abort.signal.aborted) reportAppError(error, '搜索电子书');
        current = {
          ...current,
          status: abort.signal.aborted ? 'stopped' : 'error',
          error: abort.signal.aborted ? '' : formatAppError(error, '搜索电子书'),
        };
        flush();
        saveState(current);
      } finally {
        clearTimeout(timer);
        if (id === generation.current) active.current = null;
      }
    },
    [publish]
  );

  const stopSearch = useCallback(() => {
    active.current?.flush();
    active.current?.abort.abort();
    generation.current += 1;
    active.current = null;
    const stopped: SearchView = { ...viewRef.current, status: 'stopped' };
    publish(stopped);
    saveState(stopped);
  }, [publish]);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/books/sources', { signal: abort.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new AppRequestError({ ...data, status: response.status }, '加载书源');
        setSources(data.sources || []);
      })
      .catch((error) => {
        if (!abort.signal.aborted) { reportAppError(error, '加载书源'); setSourceError(formatAppError(error, '加载书源')); }
      });
    return () => {
      abort.abort();
      active.current?.abort.abort();
      generation.current += 1;
    };
  }, []);

  useEffect(() => {
    setQ(urlQuery);
    setSourceId(urlSource);
    if (!urlQuery.trim()) {
      active.current?.abort.abort();
      generation.current += 1;
      if (!restored.current) {
        restored.current = true;
        const saved = readState();
        if (saved) {
          publish(saved);
          setQ(saved.keyword);
          setSourceId(saved.scope);
          return;
        }
      }
      publish(EMPTY_VIEW);
      return;
    }
    restored.current = true;
    const force = forceNext.current;
    forceNext.current = false;
    void beginSearch(urlQuery.trim(), urlSource, { force });
  }, [urlQuery, urlSource, beginSearch, publish]);

  const submit = (keyword: string) => {
    const text = keyword.trim();
    if (!text) return;
    setQ(text);
    if (urlQuery === text && urlSource === sourceId) {
      void beginSearch(text, sourceId, { force: true });
    } else {
      const next = new URLSearchParams({ q: text });
      if (sourceId) next.set('sourceId', sourceId);
      forceNext.current = true;
      router.replace('/books/search?' + next);
    }
  };
  const sourceOptions = useMemo(
    () => buildBookSourceOptions(sources),
    [sources]
  );
  const matchingSources = useMemo(
    () => filterBookSourceOptions(sourceOptions, sourceFilter),
    [sourceOptions, sourceFilter]
  );
  const selectedSource = sourceOptions.find((source) => source.id === sourceId);
  const selectionOutsideFilter =
    !!selectedSource &&
    !matchingSources.some((source) => source.id === sourceId);
  const scope = view.scope
    ? sourceOptions.find((source) => source.id === view.scope)?.label ||
      '所选书源'
    : '全部书源';
  const timedOut = view.failures.filter((failure) => failure.timedOut).length;
  const total = view.plan?.totalSources || 0;
  const progress = total
    ? Math.min(100, Math.round((view.completed / total) * 100))
    : 0;
  const pages = Math.max(1, Math.ceil(view.results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = useMemo(
    () =>
      view.results.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
      ),
    [currentPage, view.results]
  );
  const statusLabel = loading
    ? view.mode === 'deep'
      ? '深入搜索中'
      : '搜索中'
    : view.status === 'stopped'
    ? '已停止'
    : view.status === 'error'
    ? '搜索中断'
    : '搜索完成';

  return (
    <div className='f1-reading-search space-y-7 sm:space-y-9'>
      <section
        aria-labelledby='book-search-heading'
        className='f1-reading-search-panel border-b border-library-edge pb-6 dark:border-library-night-edge sm:pb-8'
      >
        <p
          className={cn(
            'mb-2 text-xs font-semibold tracking-[0.16em]',
            LIBRARY_MUTED
          )}
        >
          书名 · 作者 · 跨源查找
        </p>
        <h1
          id='book-search-heading'
          className={cn(
            'text-2xl font-semibold sm:text-3xl',
            LIBRARY_SERIF,
            LIBRARY_TEXT
          )}
        >
          搜索电子书
        </h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(q);
          }}
          className='mt-6'
        >
          <div className='grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto]'>
            <label className='min-w-0 sm:col-span-3 lg:col-span-1'>
              <span className={cn('mb-2 block text-xs', LIBRARY_MUTED)}>
                关键词
              </span>
              <span className='relative block'>
                <Search
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2',
                    LIBRARY_MUTED
                  )}
                />
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder='搜索书名 / 作者'
                  aria-label='搜索书名或作者'
                  className={cn(LIBRARY_FIELD, 'h-12 pl-11 pr-11 text-base')}
                />
                {q && (
                  <button
                    type='button'
                    onClick={() => setQ('')}
                    aria-label='清空搜索关键词'
                    className={cn(
                      'absolute right-0 top-0 inline-flex h-12 w-11 items-center justify-center rounded-md',
                      LIBRARY_MUTED,
                      LIBRARY_FOCUS
                    )}
                  >
                    <X aria-hidden className='h-4 w-4' />
                  </button>
                )}
              </span>
            </label>
            <label className='min-w-0 sm:col-span-2 lg:col-span-1'>
              <span className={cn('mb-2 block text-xs', LIBRARY_MUTED)}>
                搜索范围{sourceFilter.trim() ? ' · 已筛选选项' : ''}
              </span>
              <select
                aria-label='选择书源'
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className={cn(
                  LIBRARY_FIELD,
                  'h-12 cursor-pointer truncate text-base'
                )}
              >
                <option value=''>全部书源</option>
                {sourceId && !selectedSource && (
                  <option value={sourceId}>当前书源（列表暂不可用）</option>
                )}
                {selectionOutsideFilter && selectedSource && (
                  <option value={selectedSource.id}>
                    {selectedSource.label} · 当前已选
                  </option>
                )}
                {matchingSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
            <div className='flex gap-2'>
              <button
                type='submit'
                disabled={!q.trim() || loading}
                className={cn(
                  LIBRARY_BUTTON,
                  'h-12 flex-1 px-5 disabled:opacity-50'
                )}
              >
                {loading ? (
                  <Loader2
                    aria-hidden
                    className='h-4 w-4 animate-spin motion-reduce:animate-none'
                  />
                ) : (
                  <Search aria-hidden className='h-4 w-4' />
                )}
                搜索
              </button>
              {loading && (
                <button
                  type='button'
                  onClick={stopSearch}
                  className={cn(LIBRARY_GHOST_BUTTON, 'h-12 px-4')}
                >
                  <Square aria-hidden className='h-3.5 w-3.5' />
                  停止
                </button>
              )}
            </div>
          </div>
        </form>
        <details className='group mt-3 border-b border-library-edge pb-2 dark:border-library-night-edge'>
          <summary
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-sm text-sm',
              LIBRARY_MUTED,
              LIBRARY_FOCUS
            )}
          >
            <Search aria-hidden className='h-3.5 w-3.5' />
            筛选书源与说明
            <span className='ml-auto text-xs tabular-nums'>
              {sourceFilter.trim()
                ? `${matchingSources.length} 项匹配`
                : `${sourceOptions.length} 个书源`}
            </span>
            <ChevronDown
              aria-hidden
              className='h-4 w-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none'
            />
          </summary>
          <div className='grid gap-5 pb-3 pt-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
            <div className='min-w-0'>
              <label
                className={cn('mb-2 block text-xs', LIBRARY_MUTED)}
                htmlFor='book-source-filter'
              >
                名称或域名
              </label>
              <div className='relative'>
                <input
                  id='book-source-filter'
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  placeholder='例如：起点、qidian.com'
                  autoComplete='off'
                  aria-describedby='book-source-filter-help'
                  className={cn(LIBRARY_FIELD, 'h-11 pr-11 text-base')}
                />
                {sourceFilter && (
                  <button
                    type='button'
                    onClick={() => setSourceFilter('')}
                    aria-label='清除书源筛选'
                    className={cn(
                      'absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-md',
                      LIBRARY_MUTED,
                      LIBRARY_FOCUS
                    )}
                  >
                    <X aria-hidden className='h-4 w-4' />
                  </button>
                )}
              </div>
              <p
                id='book-source-filter-help'
                className={cn('mt-2 text-xs leading-relaxed', LIBRARY_MUTED)}
              >
                只筛选上方选项；“全部书源”仍搜索全部来源。
              </p>
              {!matchingSources.length && sourceFilter.trim() && (
                <p role='status' className={cn('mt-2 text-xs', LIBRARY_MUTED)}>
                  没有匹配的书源，可以清除筛选。
                  {selectionOutsideFilter ? '当前选择已保留。' : ''}
                </p>
              )}
            </div>
            <div
              className={cn(
                'min-w-0 border-l border-library-edge pl-4 dark:border-library-night-edge',
                LIBRARY_MUTED
              )}
            >
              <p className={cn('text-sm font-medium', LIBRARY_TEXT)}>
                {selectedSource
                  ? selectedSource.label
                  : sourceId
                  ? '当前书源信息暂不可用'
                  : '全部书源'}
              </p>
              {selectedSource ? (
                <>
                  {selectedSource.hostname && (
                    <p className='mt-1 break-all text-xs'>
                      {selectedSource.hostname}
                    </p>
                  )}
                  <p className='mt-3 text-xs'>原始名称与说明</p>
                  <p className='mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed'>
                    {selectedSource.originalName}
                  </p>
                </>
              ) : (
                <p className='mt-2 text-xs leading-relaxed'>
                  {sourceId
                    ? '列表恢复后可查看完整名称与说明；当前选择不会被清空。'
                    : '精简名称仅用于展示；选择具体书源后，可在这里查看完整名称与说明。'}
                </p>
              )}
            </div>
          </div>
        </details>
        <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-2'>
          <span className={cn('text-xs', LIBRARY_MUTED)}>试试</span>
          {QUICK_SEARCHES.map((keyword) => (
            <button
              type='button'
              key={keyword}
              onClick={() => submit(keyword)}
              className={cn(
                LIBRARY_GHOST_BUTTON,
                'min-h-10 border-transparent px-2 text-xs'
              )}
            >
              {keyword}
            </button>
          ))}
        </div>
        {sourceError && (
          <p role='status' className={cn('mt-3 text-sm', LIBRARY_MUTED)}>
            {sourceError}
          </p>
        )}
      </section>

      {view.status !== 'idle' && (
        <section
          aria-label='搜索进度'
          className={cn(LIBRARY_PANEL, 'f1-reading-progress overflow-hidden')}
        >
          <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5'>
            <div className='flex min-w-0 items-center gap-2.5'>
              {loading ? (
                <Loader2
                  aria-hidden
                  className='h-4 w-4 shrink-0 animate-spin text-library-ochre motion-reduce:animate-none dark:text-library-night-ochre'
                />
              ) : view.status === 'complete' ? (
                <Check
                  aria-hidden
                  className='h-4 w-4 shrink-0 text-library-ochre dark:text-library-night-ochre'
                />
              ) : (
                <AlertCircle
                  aria-hidden
                  className={cn('h-4 w-4 shrink-0', LIBRARY_MUTED)}
                />
              )}
              <div className='min-w-0'>
                <p
                  role='status'
                  className={cn('text-sm font-semibold', LIBRARY_TEXT)}
                >
                  {statusLabel}
                  <span
                    className={cn(
                      'ml-2 font-normal tabular-nums',
                      LIBRARY_MUTED
                    )}
                  >
                    {view.plan
                      ? view.completed + ' / ' + total
                      : '正在准备书源'}
                  </span>
                </p>
                <p
                  className={cn('mt-1 truncate text-xs', LIBRARY_MUTED)}
                  title={scope}
                >
                  {scope} ·{' '}
                  {view.mode === 'deep'
                    ? '继续检索第 2–5 页'
                    : '逐批检索各书源第一页'}
                </p>
              </div>
            </div>
            <div
              className={cn(
                'flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums',
                LIBRARY_MUTED
              )}
            >
              <span>
                找到{' '}
                <strong className={LIBRARY_TEXT}>{view.results.length}</strong>{' '}
                本
              </span>
              <span>失败 {view.failures.length - timedOut}</span>
              <span>超时 {timedOut}</span>
              {!!view.plan?.duplicateSources && (
                <span>跳过重复 {view.plan.duplicateSources}</span>
              )}
              {!!view.plan?.unsupportedSources && (
                <span>不支持搜索 {view.plan.unsupportedSources}</span>
              )}
            </div>
          </div>
          <div
            role='progressbar'
            aria-label='书源处理进度'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className='h-1 overflow-hidden bg-library-edge dark:bg-library-night-edge'
          >
            <div
              className='h-full origin-left bg-library-ochre transition-transform duration-200 motion-reduce:transition-none dark:bg-library-night-ochre'
              style={{ transform: 'scaleX(' + progress / 100 + ')' }}
            />
          </div>
          {view.error && (
            <p
              role='alert'
              className='border-t border-library-edge px-4 py-3 text-sm text-red-700 dark:border-library-night-edge dark:text-red-300'
            >
              {view.error}
            </p>
          )}
          {view.failures.length > 0 && (
            <details className='border-t border-library-edge px-4 py-3 dark:border-library-night-edge sm:px-5'>
              <summary className={cn('cursor-pointer text-xs', LIBRARY_MUTED)}>
                查看失败与超时详情 · {view.failures.length} 个书源
              </summary>
              <ul className='mt-3 max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-2 text-xs'>
                {view.failures.map((failure) => (
                  <li
                    key={failure.sourceId}
                    className='grid gap-1 border-t border-library-edge/70 py-2 first:border-0 dark:border-library-night-edge/70 sm:grid-cols-[minmax(8rem,1fr)_2fr]'
                  >
                    <span
                      className={cn('break-words font-medium', LIBRARY_TEXT)}
                    >
                      {failure.sourceName}
                    </span>
                    <span className={cn('break-words', LIBRARY_MUTED)}>
                      {failure.error}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section aria-label='搜索结果' className='space-y-5'>
        {view.status === 'idle' ? (
          <EmptyState
            icon={<Search className='h-6 w-6' />}
            title='从一本书开始'
            description='输入书名或作者，跨书源搜索；找到的书会陆续出现在这里。'
          />
        ) : (
          <>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h2
                className={cn(
                  'text-lg font-semibold',
                  LIBRARY_SERIF,
                  LIBRARY_TEXT
                )}
              >
                搜索结果{' '}
                <span
                  className={cn(
                    'ml-1 text-sm font-normal tabular-nums',
                    LIBRARY_MUTED
                  )}
                >
                  {view.results.length}
                </span>
              </h2>
              {!loading && (
                <div className='flex flex-wrap gap-2'>
                  <button
                    type='button'
                    onClick={() =>
                      void beginSearch(view.keyword, view.scope, {
                        force: true,
                      })
                    }
                    className={LIBRARY_GHOST_BUTTON}
                  >
                    重新搜索
                  </button>
                  {view.status === 'complete' && view.mode === 'quick' && (
                    <button
                      type='button'
                      onClick={() =>
                        void beginSearch(view.keyword, view.scope, {
                          deep: true,
                          force: true,
                        })
                      }
                      className={LIBRARY_GHOST_BUTTON}
                    >
                      <ArrowDown className='h-4 w-4' />
                      深入搜索
                    </button>
                  )}
                </div>
              )}
            </div>
            {loading && !view.results.length && <MediaGridSkeleton count={6} />}
            {visible.length > 0 && (
              <MediaGrid className='sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'>
                {visible.map((item) => (
                  <MediaCard
                    key={item.sourceId + '-' + item.id}
                    item={bookCardItem(item)}
                    href={buildBookDetailPath(item.sourceId, item.id)}
                    onNavigate={() => cacheBookListItem(item)}
                  />
                ))}
              </MediaGrid>
            )}
            <BooksPagination
              page={currentPage}
              total={view.results.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
            {!loading && !view.results.length && (
              <EmptyState
                title={
                  view.status === 'complete' && !view.failures.length
                    ? '暂未找到匹配书籍'
                    : '本次未获得可用结果'
                }
                description={
                  view.status === 'stopped'
                    ? '搜索已停止，可以重新搜索。'
                    : view.plan &&
                      !view.plan.totalSources &&
                      view.plan.unsupportedSources
                    ? '当前范围内没有已适配的搜索规则，请切换其他书源。'
                    : view.failures.length
                    ? '部分书源请求失败，可展开上方详情查看。也可以换个关键词或指定单个书源。'
                    : '试试更短的书名、作者名，或使用深入搜索查询后续页面。'
                }
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
