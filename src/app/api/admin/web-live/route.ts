import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { WEB_LIVE_PLATFORMS, normalizeWebLiveRoomId } from '@/lib/web-live';
import { validatePublicMediaUrl } from '@/lib/web-live-server';

async function parseSource(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform : '';
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
  if (!name || !roomId || !WEB_LIVE_PLATFORMS.some((item) => item.value === platform)) throw new Error('请填写名称、有效平台和直播地址');
  const normalized = normalizeWebLiveRoomId(platform, roomId);
  if (platform === 'custom') await validatePublicMediaUrl(normalized);
  const streamFormat = body.streamFormat ?? 'auto';
  if (!['auto', 'hls', 'flv'].includes(String(streamFormat))) throw new Error('无效的直播流格式');
  const image = (value: unknown) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new Error('图片地址无效');
    const input = value.trim();
    if (!input) return undefined;
    let url: URL;
    try { url = new URL(input); } catch { throw new Error('图片地址必须是有效的 HTTP 或 HTTPS 网址'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('图片地址必须是无凭据的 HTTP 或 HTTPS 网址');
    return input;
  };
  return { name, platform, roomId: normalized, streamFormat: platform === 'custom' ? streamFormat as 'auto' | 'hls' | 'flv' : undefined, avatar: image(body.avatar), cover: image(body.cover) };
}

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    const username = authInfo?.username;
    const config = await getConfig();
    if (username !== process.env.USERNAME) {
      const userInfo = await db.getUserInfoV2(username || '');
      if (!userInfo || userInfo.role !== 'admin' || userInfo.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { action } = body;

    if (!config) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    }

    if (!config.WebLiveConfig) {
      config.WebLiveConfig = [];
    }

    switch (action) {
      case 'toggleEnabled': {
        const { enabled } = body;
        config.WebLiveEnabled = enabled;
        break;
      }

      case 'add': {
        let fields;
        try { fields = await parseSource(body); } catch { return NextResponse.json({ error: '请检查名称、房间号和图片地址；自定义直播地址必须可解析到公网' }, { status: 400 }); }
        const key = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        config.WebLiveConfig.push({ key, ...fields, from: 'custom', disabled: false });
        break;
      }

      case 'delete': {
        const { key } = body;
        const source = config.WebLiveConfig.find((s) => s.key === key);
        if (!source) {
          return NextResponse.json({ error: '源不存在' }, { status: 404 });
        }
        if (source.from === 'config') {
          return NextResponse.json({ error: '无法删除配置文件中的源' }, { status: 400 });
        }
        config.WebLiveConfig = config.WebLiveConfig.filter((s) => s.key !== key);
        break;
      }

      case 'enable': {
        const { key } = body;
        const source = config.WebLiveConfig.find((s) => s.key === key);
        if (!source) {
          return NextResponse.json({ error: '源不存在' }, { status: 404 });
        }
        source.disabled = false;
        break;
      }

      case 'disable': {
        const { key } = body;
        const source = config.WebLiveConfig.find((s) => s.key === key);
        if (!source) {
          return NextResponse.json({ error: '源不存在' }, { status: 404 });
        }
        source.disabled = true;
        break;
      }

      case 'edit': {
        const { key } = body;
        const source = config.WebLiveConfig.find((s) => s.key === key);
        if (!source) return NextResponse.json({ error: '源不存在' }, { status: 404 });
        if (source.from === 'config') return NextResponse.json({ error: '无法编辑配置文件中的源' }, { status: 400 });
        let fields;
        try { fields = await parseSource(body); } catch { return NextResponse.json({ error: '请检查名称、房间号和图片地址；自定义直播地址必须可解析到公网' }, { status: 400 }); }
        Object.assign(source, fields);
        break;
      }

      case 'sort': {
        const { keys } = body;
        const existing = new Map(config.WebLiveConfig.map((source) => [source.key, source]));
        if (!Array.isArray(keys) || keys.length !== config.WebLiveConfig.length || existing.size !== config.WebLiveConfig.length || new Set(keys).size !== keys.length || keys.some((key) => typeof key !== 'string' || !existing.has(key))) {
          return NextResponse.json({ error: '排序数据必须包含所有直播源且不能重复' }, { status: 400 });
        }
        const sorted = keys.map((key: string) => existing.get(key)!);
        await db.saveAdminConfig({ ...config, WebLiveConfig: sorted });
        config.WebLiveConfig = sorted;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    await db.saveAdminConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
