import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import { MangaRecommendType } from '@/lib/manga.types';
import { suwayomiClient } from '@/lib/suwayomi.client';

import { getAuthorizedUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId')?.trim();
    const page = Number(searchParams.get('page') || '1');
    const typeParam = searchParams.get('type')?.trim().toUpperCase();
    const type: MangaRecommendType = typeParam === 'LATEST' ? 'LATEST' : 'POPULAR';

    if (!sourceId) {
      return NextResponse.json({ mangas: [], hasNextPage: false });
    }

    const result = await suwayomiClient.getRecommendedManga(sourceId, type, page);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json((({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '漫画服务')), { status: 500 });
  }
}
