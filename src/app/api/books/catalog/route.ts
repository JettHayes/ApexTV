import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import { bookProvider } from '@/lib/book-provider';
import {
  BookCatalogTargetError,
  BookSourceRequestError,
} from '@/lib/book-source-error';

import { getAuthorizedBooksUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId')?.trim();
    const href = searchParams.get('href')?.trim() || undefined;
    if (!sourceId) {
      return NextResponse.json({ error: '缺少 sourceId' }, { status: 400 });
    }
    const result = await bookProvider.getCatalog(sourceId, href);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BookCatalogTargetError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    if (error instanceof BookSourceRequestError)
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          upstreamStatus: error.upstreamStatus,
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    return NextResponse.json(
      (({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '电子书服务')),
      { status: 500 }
    );
  }
}
