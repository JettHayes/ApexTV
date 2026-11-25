import { reportAppError } from '@/lib/app-error';
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';
import { isWebLivePlatformEnabled, normalizeWebLiveRoomId } from '@/lib/web-live';

export const dynamic = 'force-dynamic'; // 禁用缓存

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'web_live', '无权限访问网络直播');
    if (authResult instanceof NextResponse) return authResult;
    const config = await getConfig();
    if (!config?.WebLiveConfig) {
      return NextResponse.json([]);
    }

    const sources = config.WebLiveConfig.filter(s => !s.disabled && isWebLivePlatformEnabled(s.platform)).map((source) => {
      try { return { ...source, name: source.name.trim(), roomId: normalizeWebLiveRoomId(source.platform, source.roomId) }; }
      catch { return { ...source, roomId: source.roomId.trim() }; }
    });
    return NextResponse.json(sources, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const info = reportAppError(error, '获取直播源');
    return NextResponse.json(
      { error: info.message, code: info.code, upstreamStatus: info.upstreamStatus },
      { status: 500 }
    );
  }
}
