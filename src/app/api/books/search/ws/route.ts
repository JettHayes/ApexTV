import { NextRequest, NextResponse } from 'next/server';

import { abortError } from '@/lib/book-search';
import { bookProvider, BookSearchPlanChangedError } from '@/lib/book-provider';

import { getAuthorizedBooksUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;
  const params = request.nextUrl.searchParams;
  const q = params.get('q')?.trim();
  if (!q)
    return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
  let prepared;
  try {
    prepared = await bookProvider.prepareSearchBatch(params, request.signal);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BookSearchPlanChangedError
            ? error.message
            : '无法加载搜索书源，请稍后重试',
      },
      { status: error instanceof BookSearchPlanChangedError ? 409 : 503 }
    );
  }

  const batch = prepared;
  const encoder = new TextEncoder();
  const abort = new AbortController();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const onAbort = () => abort.abort(abortError());
  request.signal.addEventListener('abort', onAbort, { once: true });
  if (request.signal.aborted) onAbort();
  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    request.signal.removeEventListener('abort', onAbort);
  };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        if (closed || abort.signal.aborted) return;
        try {
          controller.enqueue(
            encoder.encode('data: ' + JSON.stringify(payload) + '\n\n')
          );
        } catch {
          closed = true;
          onAbort();
        }
      };
      heartbeat = setInterval(() => send({ type: 'heartbeat' }), 10000);
      try {
        send({ type: 'start', ...batch.summary });
        const result = await bookProvider.searchBatch(q, batch, {
          signal: abort.signal,
          forceRefresh: params.get('refresh') === '1',
          onEvent: send,
        });
        send({
          type: 'complete',
          ...batch.summary,
          completedSources: result.completedSources,
          failedSources: result.failedSources,
          timedOutSources: result.timedOutSources,
        });
      } catch {
        send({
          type: 'error',
          error: '本批搜索中断，已找到的结果已保留，请重试',
        });
      } finally {
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          /* The browser may already have disconnected. */
        }
      }
    },
    cancel() {
      closed = true;
      onAbort();
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
