import { NextRequest, NextResponse } from 'next/server';

import { bookProvider } from '@/lib/book-provider';

import { getAuthorizedBooksUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;
  try {
    const params = request.nextUrl.searchParams;
    const plan = await bookProvider.getSearchPlan(
      params.get('sourceId') || undefined,
      params.get('mode') === 'deep' ? 'deep' : 'quick',
      request.signal
    );
    const { sources: _sources, cacheTTL: _cacheTTL, ...summary } = plan;
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: '无法加载搜索书源，请稍后重试' },
      { status: 503 }
    );
  }
}
