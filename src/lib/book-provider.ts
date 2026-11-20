import {
  BookCatalogResult,
  BookDetail,
  BookListItem,
  BookSearchFailure,
  BookSearchResult,
  BookSource,
} from './book.types';
import { legadoClient } from './legado.client';
import { opdsClient } from './opds.client';
import { getConfig } from './config';
import { BookRuleParseError } from './book-source-error';
import {
  abortable,
  BOOK_SEARCH_BATCH_SIZE,
  createBookSearchPlan,
  runBookSearchBatch,
  type BookSearchEvent,
  type BookSearchOptions,
} from './book-search';

export class BookSearchPlanChangedError extends Error {}

function sourceKind(source?: Pick<BookSource, 'type'>) {
  return source?.type === 'legado' || (source as BookSource | undefined)?.legado
    ? 'legado'
    : 'opds';
}

export class BookProvider {
  async getSources(): Promise<BookSource[]> {
    const config = await getConfig();
    const [opdsSources, legadoSources] = await Promise.all([
      opdsClient.getSources(config),
      legadoClient.getSources(config),
    ]);
    return [
      ...opdsSources.map((source) => ({
        ...source,
        type: source.type || ('opds' as const),
      })),
      ...legadoSources,
    ];
  }

  async getSourceById(sourceId: string): Promise<BookSource> {
    const sources = await this.getSources();
    const source = sources.find((item) => item.id === sourceId);
    if (!source) throw new Error('未找到对应的电子书源');
    return source;
  }

  async getCatalog(
    sourceId: string,
    href?: string
  ): Promise<BookCatalogResult> {
    const source = await this.getSourceById(sourceId);
    return sourceKind(source) === 'legado'
      ? legadoClient.getCatalog(sourceId, href)
      : opdsClient.getCatalog(sourceId, href);
  }

  async getSearchSources(sourceId?: string): Promise<BookSource[]> {
    if (sourceId) return [await this.getSourceById(sourceId)];
    return this.getSources();
  }

  async searchBooksSource(
    q: string,
    source: BookSource,
    options: BookSearchOptions = {}
  ): Promise<{ source: BookSource; results: BookListItem[] }> {
    return sourceKind(source) === 'legado'
      ? legadoClient.searchBooksSource(q, source, options)
      : opdsClient.searchBooksSource(q, source, options);
  }

  async getSearchPlan(sourceId?: string, mode = 'quick', signal?: AbortSignal) {
    const config = await abortable(getConfig(), signal);
    const [opds, legado] = await abortable(
      Promise.all([
        opdsClient.getSources(config, false),
        legadoClient.getSources(config),
      ]),
      signal
    );
    let sources = [...opds, ...legado];
    if (sourceId) {
      sources = sources.filter((source) => source.id === sourceId);
      if (!sources.length)
        throw new Error('未找到对应的电子书源，请刷新书源列表');
    }
    if (mode === 'deep')
      sources = sources.filter((source) => sourceKind(source) === 'legado');
    return {
      ...createBookSearchPlan(sources),
      cacheTTL: config.OPDSConfig?.CacheTTL ?? 600000,
    };
  }

  async prepareSearchBatch(params: URLSearchParams, signal?: AbortSignal) {
    const mode = params.get('mode') === 'deep' ? 'deep' : 'quick';
    const batch = Number(params.get('batch') || 0);
    if (!Number.isSafeInteger(batch) || batch < 0)
      throw new Error('无效的搜索批次');
    const plan = await this.getSearchPlan(
      params.get('sourceId')?.trim() || undefined,
      mode,
      signal
    );
    if (params.get('revision') && params.get('revision') !== plan.revision) {
      throw new BookSearchPlanChangedError(
        '书源配置已更新，请重新搜索；本次已找到的结果会保留'
      );
    }
    const offset = batch * BOOK_SEARCH_BATCH_SIZE;
    const sources = plan.sources.slice(offset, offset + BOOK_SEARCH_BATCH_SIZE);
    const { cacheTTL, sources: _all, ...summary } = plan;
    return {
      sources,
      cacheTTL,
      summary: {
        ...summary,
        offset,
        batch,
        nextBatch:
          offset + sources.length < plan.totalSources ? batch + 1 : null,
        mode,
      },
    };
  }

  async searchBatch(
    q: string,
    prepared: Awaited<ReturnType<BookProvider['prepareSearchBatch']>>,
    options: {
      signal?: AbortSignal;
      onEvent?: (event: BookSearchEvent) => void;
      forceRefresh?: boolean;
    } = {}
  ) {
    return runBookSearchBatch(
      prepared.sources,
      (source, signal) =>
        this.searchBooksSource(q, source, {
          signal,
          cacheTTL: prepared.cacheTTL,
          startPage: prepared.summary.mode === 'deep' ? 2 : 1,
          pageLimit: prepared.summary.mode === 'deep' ? 4 : 1,
          forceRefresh: options.forceRefresh,
        }),
      options
    );
  }

  async searchBooks(q: string, sourceId?: string): Promise<BookSearchResult> {
    const plan = await this.getSearchPlan(sourceId);
    const results: BookListItem[] = [];
    const failedSources: BookSearchFailure[] = [];
    for (
      let offset = 0;
      offset < plan.sources.length;
      offset += BOOK_SEARCH_BATCH_SIZE
    ) {
      const batch = await runBookSearchBatch(
        plan.sources.slice(offset, offset + BOOK_SEARCH_BATCH_SIZE),
        (source, signal) =>
          this.searchBooksSource(q, source, {
            signal,
            cacheTTL: plan.cacheTTL,
            pageLimit: 1,
          })
      );
      results.push(...batch.results);
      failedSources.push(...batch.failedSources);
    }
    return { results, failedSources };
  }

  async getBookDetail(
    sourceId: string,
    href: string,
    fallback?: Partial<BookDetail>
  ): Promise<BookDetail> {
    const source = await this.getSourceById(sourceId);
    return sourceKind(source) === 'legado'
      ? legadoClient.getBookDetail(sourceId, href, fallback)
      : opdsClient.getBookDetail(sourceId, href, fallback);
  }

  async getPreferredAcquisition(
    sourceId: string,
    href: string
  ): Promise<{ format: 'epub' | 'pdf' | 'chapters'; href: string }> {
    const source = await this.getSourceById(sourceId);
    if (sourceKind(source) === 'legado') {
      const detail = await legadoClient.getBookDetail(sourceId, href);
      if (detail.readingUnavailableReason) throw new BookRuleParseError(detail.readingUnavailableReason);
      const chapters =
        detail.acquisitionLinks.find(
          (item) => item.type === 'application/x-legado-chapters+json'
        ) || detail.acquisitionLinks[0];
      if (!chapters?.href) throw new Error('当前书籍没有可用章节目录');
      return { format: 'chapters', href: chapters.href };
    }
    return opdsClient.getPreferredAcquisition(sourceId, href);
  }
}

export const bookProvider = new BookProvider();
