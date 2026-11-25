import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import { suwayomiClient } from '@/lib/suwayomi.client';

import { getAuthorizedUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const sourceId = searchParams.get('sourceId')?.trim() || undefined;
    const page = Number(searchParams.get('page') || '1');

    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const result = await suwayomiClient.searchManga(q, sourceId, page);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json((({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '漫画服务')), { status: 500 });
  }
}
