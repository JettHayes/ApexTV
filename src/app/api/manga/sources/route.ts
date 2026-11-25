import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import { suwayomiClient } from '@/lib/suwayomi.client';

import { getAuthorizedUsername } from '../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const lang = new URL(request.url).searchParams.get('lang') || process.env.SUWAYOMI_DEFAULT_LANG || 'zh';
    const sources = await suwayomiClient.getSources(lang);
    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json((({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '漫画服务')), { status: 500 });
  }
}
