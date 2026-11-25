import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import { bookProvider } from '@/lib/book-provider';

import { getAuthorizedBooksUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const sources = await bookProvider.getSources();
    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json((({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '电子书服务')), { status: 500 });
  }
}
