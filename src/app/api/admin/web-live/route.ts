import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { isWebLivePlatformEnabled, normalizeWebLiveRoomId } from '@/lib/web-live';
import { validatePublicMediaUrl } from '@/lib/web-live-server';

async function parseSource(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const platform = typeof body.platform === 'string' ? body.platform : '';
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
  if (!name || !roomId || !isWebLivePlatformEnabled(platform)) throw new Error('请填写名称、有效平台和直播地址');
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

class LiveConfigError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function POST(request: NextRequest) {
  try {
    const username = getAuthInfoFromCookie(request)?.username;
    if (!username) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (username !== process.env.USERNAME) {
      const user = await db.getUserInfoV2(username);
      if (!user || user.role !== 'admin' || user.banned) return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    const body = await request.json();
    const action = body.action;
    let fields: Awaited<ReturnType<typeof parseSource>> | undefined;
    if (action === 'add' || action === 'edit') {
      try { fields = await parseSource(body); }
      catch { throw new LiveConfigError('请检查名称、平台和链接格式；自定义直播地址必须可解析到公网'); }
    }
    // Initialize if needed, then apply this action to the latest database snapshot.
    await getConfig();
    const newKey = 'web_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await db.updateAdminConfig((config) => {
      config.WebLiveConfig = config.WebLiveConfig || [];
      const list = config.WebLiveConfig;
      const source = list.find((item) => item.key === body.key);
      switch (action) {
        case 'toggleEnabled':
          if (typeof body.enabled !== 'boolean') throw new LiveConfigError('无效的开关状态');
          config.WebLiveEnabled = body.enabled;
          break;
        case 'add':
          if (list.some((item) => {
            try { return item.platform === fields!.platform && normalizeWebLiveRoomId(item.platform, item.roomId) === fields!.roomId; }
            catch { return false; }
          })) throw new LiveConfigError('此直播间已经添加，请编辑现有记录');
          list.push({ key: newKey, ...fields!, from: 'custom', disabled: false });
          break;
        case 'delete':
        case 'edit':
        case 'enable':
        case 'disable':
          if (!source) throw new LiveConfigError('直播源已变更，请刷新页面', 409);
          if ((action === 'delete' || action === 'edit') && source.from === 'config') throw new LiveConfigError('无法修改配置文件中的直播源');
          if (action === 'delete') config.WebLiveConfig = list.filter((item) => item.key !== body.key);
          else if (action === 'edit') Object.assign(source, fields);
          else source.disabled = action === 'disable';
          break;
        case 'sort': {
          const keys = body.keys;
          const existing = new Map(list.map((item) => [item.key, item]));
          if (!Array.isArray(keys) || keys.length !== list.length || new Set(keys).size !== keys.length || keys.some((key) => typeof key !== 'string' || !existing.has(key))) {
            throw new LiveConfigError('直播列表已变更，请刷新后重新排序', 409);
          }
          config.WebLiveConfig = keys.map((key: string) => existing.get(key)!);
          break;
        }
        default: throw new LiveConfigError('未知操作');
      }
    });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof LiveConfigError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: '配置保存失败，请刷新列表后重试' }, { status: 503 });
  }
}
