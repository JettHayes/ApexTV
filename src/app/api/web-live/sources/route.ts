import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';
import { normalizeWebLiveRoomId } from '@/lib/web-live';

export const dynamic = 'force-dynamic'; // 禁用缓存

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'web_live', '无权限访问网络直播');
    if (authResult instanceof NextResponse) return authResult;
    const config = await getConfig();
    if (!config?.WebLiveConfig) {
      return NextResponse.json([]);
    }

    const sources = config.WebLiveConfig.filter(s => !s.disabled).map((source) => {
      try { return { ...source, name: source.name.trim(), roomId: normalizeWebLiveRoomId(source.platform, source.roomId) }; }
      catch { return { ...source, roomId: source.roomId.trim() }; }
    });
    return NextResponse.json(sources, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}
