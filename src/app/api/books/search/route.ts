import { NextRequest, NextResponse } from 'next/server';

import { bookProvider, BookSearchPlanChangedError } from '@/lib/book-provider';

import { getAuthorizedBooksUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    if (!q) {
      return NextResponse.json({ results: [], failedSources: [] });
    }
    const prepared = await bookProvider.prepareSearchBatch(
      searchParams,
      request.signal
    );
    const result = await bookProvider.searchBatch(q, prepared, {
      signal: request.signal,
      forceRefresh: searchParams.get('refresh') === '1',
    });
    return NextResponse.json(
      { ...result, ...prepared.summary },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BookSearchPlanChangedError
            ? error.message
            : '本批搜索失败，请稍后重试',
      },
      { status: error instanceof BookSearchPlanChangedError ? 409 : 503 }
    );
  }
}
