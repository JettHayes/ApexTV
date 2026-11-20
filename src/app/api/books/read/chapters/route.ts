import { NextRequest, NextResponse } from 'next/server';

import { legadoClient } from '@/lib/legado.client';
import {
  BookRuleParseError,
  BookSourceRequestError,
} from '@/lib/book-source-error';

import { getAuthorizedBooksUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId')?.trim();
    const bookId = searchParams.get('bookId')?.trim();
    const href = searchParams.get('href')?.trim() || '';

    if (!sourceId)
      return NextResponse.json({ error: '缺少 sourceId' }, { status: 400 });

    const chapters = href
      ? await legadoClient.getChapters(sourceId, href)
      : bookId
      ? await legadoClient.getChaptersByBookId(sourceId, bookId)
      : null;
    if (!chapters)
      return NextResponse.json(
        { error: '缺少 bookId 或 href，无法定位章节目录' },
        { status: 400 }
      );
    return NextResponse.json(
      { chapters },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      {
        status:
          error instanceof BookRuleParseError
            ? 422
            : error instanceof BookSourceRequestError
            ? 502
            : 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
