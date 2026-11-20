import type { BookListItem, BookSearchFailure } from './book.types';

export interface BookSearchPlanSummary {
  revision: string;
  totalSources: number;
  originalSources: number;
  duplicateSources: number;
  unsupportedSources: number;
  batchSize: number;
}

export interface BookSearchPayload extends Partial<BookSearchPlanSummary> {
  type:
    | 'start'
    | 'source_result'
    | 'source_error'
    | 'heartbeat'
    | 'complete'
    | 'error';
  sourceId?: string;
  sourceName?: string;
  results?: BookListItem[];
  error?: string;
  timedOut?: boolean;
  completedSources?: number;
  failedSources?: BookSearchFailure[];
  nextBatch?: number | null;
}

export async function traverseBookSearchBatches(
  plan: BookSearchPlanSummary,
  params: URLSearchParams,
  signal: AbortSignal,
  streaming: boolean,
  onEvent: (payload: BookSearchPayload, offset: number) => void
) {
  if (!Number.isInteger(plan.batchSize) || plan.batchSize <= 0)
    throw new Error('搜索批次信息无效');
  let batch: number | null = plan.totalSources ? 0 : null;
  while (batch !== null && !signal.aborted) {
    const offset = batch * plan.batchSize;
    const request = new URLSearchParams(params);
    request.set('revision', plan.revision);
    request.set('batch', String(batch));
    const complete = await fetchBookSearchBatch(
      request,
      signal,
      streaming,
      (payload) => onEvent(payload, offset)
    );
    if (signal.aborted) return;
    const expected = Math.min(plan.batchSize, plan.totalSources - offset);
    if (complete.completedSources !== expected)
      throw new Error('本批搜索未完成，已找到的结果已保留，请重试');
    const next: number | null = complete.nextBatch ?? null;
    const expectedNext =
      offset + expected < plan.totalSources ? batch + 1 : null;
    if (next !== expectedNext)
      throw new Error('搜索批次不完整，请重新搜索；已找到的结果已保留');
    batch = next;
  }
}

export async function fetchBookSearchPlan(
  params: URLSearchParams,
  signal: AbortSignal
): Promise<BookSearchPlanSummary> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`/api/books/search/plan?${params}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || '无法加载搜索书源');
    return json;
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted)
      throw new Error('搜索书源加载超时，请稍后重试');
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

// Each request covers one bounded batch. Fetch streams allow a real abort,
// unlike closing a progress listener while the server keeps searching.
export async function fetchBookSearchBatch(
  params: URLSearchParams,
  signal: AbortSignal,
  streaming: boolean,
  onEvent: (payload: BookSearchPayload) => void
): Promise<BookSearchPayload> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  let idleTimer: ReturnType<typeof setTimeout>;
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), streaming ? 35000 : 90000);
  };
  const deadline = setTimeout(() => controller.abort(), 90000);
  resetIdle();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(
      `/api/books/search${streaming ? '/ws' : ''}?${params}`,
      {
        signal: controller.signal,
        cache: 'no-store',
      }
    );
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.error || '本批搜索失败，请重试');
    }
    if (!streaming) {
      const result = await response.json();
      onEvent({
        type: 'source_result',
        results: result.results,
        completedSources: result.completedSources,
      });
      const complete: BookSearchPayload = { ...result, type: 'complete' };
      onEvent(complete);
      return complete;
    }
    if (!response.body) throw new Error('浏览器未能建立搜索连接');
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let complete: BookSearchPayload | undefined;
    const consume = () => {
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        const payload = JSON.parse(data) as BookSearchPayload;
        if (payload.type === 'error')
          throw new Error(payload.error || '搜索中断');
        onEvent(payload);
        if (payload.type === 'complete') complete = payload;
      }
    };
    while (!complete) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        consume();
        break;
      }
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 8 * 1024 * 1024)
        throw new Error('搜索响应过大，请缩小搜索范围');
      consume();
    }
    if (!complete) throw new Error('搜索连接已中断，已找到的结果已保留');
    return complete;
  } catch (error) {
    if (signal.aborted) throw error;
    if (controller.signal.aborted)
      throw new Error('搜索连接超时，已找到的结果已保留，请重试');
    throw error;
  } finally {
    clearTimeout(idleTimer!);
    clearTimeout(deadline);
    signal.removeEventListener('abort', cancel);
    await reader?.cancel().catch(() => undefined);
  }
}
