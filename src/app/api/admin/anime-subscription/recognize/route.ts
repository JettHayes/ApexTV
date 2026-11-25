import { appErrorPayload, reportAppError } from '@/lib/app-error';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { recognizeFansubGroups } from '@/lib/anime-fansub-recognize';
import { searchACG } from '@/lib/anime-subscription';

export const runtime = 'nodejs';

/**
 * POST /api/admin/anime-subscription/recognize
 * 智能识别：按番剧名搜索一次，对结果做「字幕组 × 字幕形态」分组
 */
export async function POST(req: NextRequest) {
  try {
    // 权限检查
    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo || (authInfo.role !== 'admin' && authInfo.role !== 'owner')) {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    const { title, source } = await req.json();
    const keyword = typeof title === 'string' ? title.trim() : '';
    if (!keyword) {
      return NextResponse.json({ error: '番剧名称不能为空' }, { status: 400 });
    }
    if (!['acgrip', 'mikan', 'dmhy', 'nyaa'].includes(source)) {
      return NextResponse.json({ error: '无效的搜索源' }, { status: 400 });
    }

    const items = await searchACG(keyword, source);
    const result = recognizeFansubGroups(items.map((item: { title: string }) => item.title));

    return NextResponse.json(result);
  } catch (error: any) {
    reportAppError(error, "追番订阅智能识别失败");
    return NextResponse.json(
      {...{ error: error.message || '智能识别失败' }, ...appErrorPayload(error, "后台配置服务", 500)},
      { status: 500 }
    );
  }
}
