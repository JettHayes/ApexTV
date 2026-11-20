import crypto from 'crypto';

import type { BookListItem, BookSearchFailure, BookSource } from './book.types';

export const BOOK_SEARCH_BATCH_SIZE = 20;
export const BOOK_SEARCH_CONCURRENCY = 8;
export const BOOK_SEARCH_SOURCE_TIMEOUT_MS = 20000;

export interface BookSearchOptions {
  signal?: AbortSignal;
  cacheTTL?: number;
  startPage?: number;
  pageLimit?: number;
  forceRefresh?: boolean;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// Keep the complete rules and authentication settings: sharing a domain is not
// enough to treat two sources as interchangeable. Source IDs remain unchanged.
export function bookSourceFingerprint(source: BookSource): string {
  const {
    id: _id,
    name: _name,
    capabilities: _capabilities,
    revision: _revision,
    ...settings
  } = source;
  return crypto.createHash('sha256').update(stableJson(settings)).digest('hex');
}

export function hasLegadoSearchRules(source: BookSource): boolean {
  const rule = source.legado;
  const list = rule?.ruleSearch?.bookList?.trim() || '';
  return (
    !!rule?.searchUrl?.trim() &&
    !!list &&
    !/^@js:/i.test(list) &&
    !!list.replace(/<js>[\s\S]*?<\/js>/gi, '').trim()
  );
}

export function createBookSearchPlan(sources: BookSource[]) {
  const seen = new Set<string>();
  let duplicateSources = 0;
  let unsupportedSources = 0;
  const searchable = sources.filter((source) => {
    if (source.enabled === false) return false;
    const supported = source.legado
      ? hasLegadoSearchRules(source)
      : source.capabilities?.searchSupported !== false ||
        !!source.searchTemplate;
    if (!supported) {
      unsupportedSources += 1;
      return false;
    }
    const fingerprint = bookSourceFingerprint(source);
    if (seen.has(fingerprint)) {
      duplicateSources += 1;
      return false;
    }
    seen.add(fingerprint);
    return true;
  });
  const revision = crypto
    .createHash('sha256')
    .update('book-rules-v2|')
    .update(
      searchable
        .map((source) => `${source.id}:${bookSourceFingerprint(source)}`)
        .join('|')
    )
    .digest('hex')
    .slice(0, 24);
  return {
    sources: searchable,
    revision,
    totalSources: searchable.length,
    originalSources: sources.length,
    duplicateSources,
    unsupportedSources,
    batchSize: BOOK_SEARCH_BATCH_SIZE,
  };
}

export function abortError(message = '搜索已停止') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function cacheBookValue<T>(
  cache: Map<string, { data: T; expiresAt: number }>,
  key: string,
  data: T,
  ttl: number,
  limit = 128
) {
  const now = Date.now();
  if (ttl <= 0) return;
  if (cache.size >= limit) {
    for (const [oldKey, value] of Array.from(cache.entries()))
      if (value.expiresAt <= now) cache.delete(oldKey);
    while (cache.size >= limit)
      cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, { data, expiresAt: now + ttl });
}

// Race non-abortable work (such as DNS/config reads) as well as forwarding the
// signal to fetch. Always remove the listener, including on normal completion.
export async function abortable<T>(
  work: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) throw signal.reason || abortError();
  let onAbort: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason || abortError());
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export function isUsableBookResult(item: BookListItem): boolean {
  const title = item.title?.trim();
  if (!title || title === '未命名电子书' || /@js:|<\/?js>|\{\{/.test(title))
    return false;
  return !!item.detailHref || item.acquisitionLinks.length > 0;
}

export interface BookSearchEvent {
  type: 'source_result' | 'source_error';
  sourceId: string;
  sourceName: string;
  completedSources: number;
  results?: BookListItem[];
  error?: string;
  timedOut?: boolean;
}

export async function runBookSearchBatch(
  sources: BookSource[],
  search: (
    source: BookSource,
    signal: AbortSignal
  ) => Promise<{ results: BookListItem[] }>,
  options: {
    signal?: AbortSignal;
    onEvent?: (event: BookSearchEvent) => void;
    timeoutMs?: number;
  } = {}
) {
  const results: BookListItem[] = [];
  const failedSources: BookSearchFailure[] = [];
  let next = 0;
  let completedSources = 0;
  let timedOutSources = 0;
  const worker = async () => {
    while (next < sources.length && !options.signal?.aborted) {
      const source = sources[next++];
      const controller = new AbortController();
      const onAbort = () =>
        controller.abort(options.signal?.reason || abortError());
      options.signal?.addEventListener('abort', onAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(abortError('书源搜索超时'));
      }, options.timeoutMs ?? BOOK_SEARCH_SOURCE_TIMEOUT_MS);
      try {
        const response = await abortable(
          search(source, controller.signal),
          controller.signal
        );
        const valid = response.results.filter(isUsableBookResult);
        const keys = new Set<string>();
        const unique = valid.filter((item) => {
          const key = `${item.sourceId}|${item.detailHref || item.id}`;
          if (keys.has(key)) return false;
          keys.add(key);
          return true;
        });
        results.push(...unique);
        completedSources += 1;
        options.onEvent?.({
          type: 'source_result',
          sourceId: source.id,
          sourceName: source.name,
          completedSources,
          results: unique,
        });
      } catch (error) {
        if (options.signal?.aborted) break;
        const message = timedOut
          ? '书源搜索超时'
          : error instanceof Error
          ? error.message.replace(/https?:\/\/\S+/g, '[书源地址]').slice(0, 240)
          : '书源搜索失败';
        failedSources.push({
          sourceId: source.id,
          sourceName: source.name,
          error: message,
          timedOut,
        });
        if (timedOut) timedOutSources += 1;
        completedSources += 1;
        options.onEvent?.({
          type: 'source_error',
          sourceId: source.id,
          sourceName: source.name,
          completedSources,
          error: message,
          timedOut,
        });
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(BOOK_SEARCH_CONCURRENCY, sources.length) },
      worker
    )
  );
  return { results, failedSources, completedSources, timedOutSources };
}
