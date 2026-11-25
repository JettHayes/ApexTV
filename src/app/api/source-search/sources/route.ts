import { reportAppError } from '@/lib/app-error';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: '请先登录后重试' }, { status: 401 });
  }

  try {
    const specialOnly = request.nextUrl.searchParams.get('special') === '1';
    const apiSites = await getAvailableApiSites(authInfo.username, specialOnly);

    return NextResponse.json({
      sources: apiSites.map((site) => ({
        key: site.key,
        name: site.name,
        api: site.api,
      })),
    });
  } catch (error) {
    reportAppError(error, '获取视频源');
    return NextResponse.json(
      { error: '获取视频源失败，请稍后重试' },
      { status: 500 }
    );
  }
}
