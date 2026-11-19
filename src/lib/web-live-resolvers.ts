import crypto from 'crypto';

import type { WebLivePlayback, WebLiveVariant } from '@/lib/web-live';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const md5 = (value: string) => crypto.createHash('md5').update(value).digest('hex');

async function request(url: string, signal?: AbortSignal, init: RequestInit = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12000);
  timer.unref?.();
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`上游请求失败 (${response.status})`);
    }
    return { headers: response.headers, text: await response.text() };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function json(url: string, signal?: AbortSignal, init: RequestInit = {}): Promise<any> {
  return JSON.parse((await request(url, signal, init)).text);
}

function result(variants: WebLiveVariant[], info: Partial<WebLivePlayback>): WebLivePlayback {
  if (!variants.length) throw new Error('直播未开启或平台未返回可用播放地址');
  return { ...info, kind: 'stream', url: variants[0].url, type: variants[0].type, variants };
}

function headers(referer: string) { return { 'User-Agent': UA, Referer: referer }; }
function image(value: any): string | undefined {
  if (typeof value === 'string') return value || undefined;
  if (!value || typeof value !== 'object') return undefined;
  for (const candidate of [value.url_list?.[0], value.urlList?.[0], value.big, value.middle, value.small, value.url]) {
    if (typeof candidate === 'string' && candidate) return candidate;
  }
  return undefined;
}

function balancedObject(source: string, start: number): string | undefined {
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  return undefined;
}

function huyaAntiCode(raw: string, name: string, rate: number): string {
  const input = new URLSearchParams(raw.replace(/&amp;/g, '&'));
  const fm = input.get('fm');
  if (!fm) { input.set('ratio', String(rate)); return input.toString(); }
  const uid = 12340000 + crypto.randomInt(10000);
  const converted = ((uid << 8) | (uid >>> 24)) >>> 0;
  const time = Date.now(), seq = uid + time;
  const ctype = input.get('ctype') || 'huya_live';
  const wsTime = input.get('wsTime') || Math.floor(time / 1000 + 3600).toString(16);
  const prefix = Buffer.from(fm, 'base64').toString('utf8').split('_')[0];
  return new URLSearchParams({ wsSecret: md5(`${prefix}_${converted}_${name}_${md5(`${seq}|${ctype}|100`)}_${wsTime}`), wsTime, ctype, fs: input.get('fs') || '', seqid: String(seq), u: String(converted), sdk_sid: String(time), ratio: String(rate), t: '100', ver: '1', sv: '2401090219', codec: '264' }).toString();
}

async function huya(roomId: string, signal?: AbortSignal): Promise<WebLivePlayback> {
  const page = (await request(`https://www.huya.com/${encodeURIComponent(roomId)}`, signal, { headers: headers('https://www.huya.com/') })).text;
  const marker = /["']?stream["']?\s*:\s*/g;
  let data: any;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(page))) {
    const offset = marker.lastIndex;
    try {
      if (page[offset] === '"') {
        const encoded = page.slice(offset + 1).match(/^([^"\\]+)"/);
        if (encoded) data = JSON.parse(Buffer.from(encoded[1], 'base64').toString('utf8'));
      } else if (page[offset] === '{') {
        const object = balancedObject(page, offset);
        if (object) data = JSON.parse(object);
      }
    } catch { /* Try the next stream field. */ }
    if (data?.data?.[0]?.gameStreamInfoList) break;
  }
  const entry = data?.data?.[0], info = entry?.gameLiveInfo || {};
  const streams = Array.isArray(entry?.gameStreamInfoList) ? entry.gameStreamInfoList.slice(0, 3) : [];
  const rates: any[] = Array.isArray(data?.vMultiStreamInfo) && data.vMultiStreamInfo.length ? data.vMultiStreamInfo.slice() : [{ iBitRate: 0, sDisplayName: '原画' }];
  rates.sort((a, b) => (Number(b.iBitRate) || 1000000) - (Number(a.iBitRate) || 1000000));
  const variants: WebLiveVariant[] = [];
  for (const rate of rates.slice(0, 5)) for (const type of ['hls', 'flv'] as const) for (const stream of streams) {
    const base = type === 'hls' ? stream.sHlsUrl : stream.sFlvUrl;
    const suffix = type === 'hls' ? stream.sHlsUrlSuffix : stream.sFlvUrlSuffix;
    const anti = type === 'hls' ? stream.sHlsAntiCode : stream.sFlvAntiCode;
    if (!base || !suffix || !anti || !stream.sStreamName) continue;
    const cdn = String(stream.sCdnType || '线路');
    const quality = Number(rate.iBitRate) || 0;
    const url = `${base}/${stream.sStreamName}.${suffix}?${huyaAntiCode(anti, stream.sStreamName, quality)}`;
    if (!/^https?:\/\//i.test(url)) continue;
    variants.push({ id: `${type}-${cdn}-${quality}`, label: `${rate.sDisplayName || (quality ? `${quality}K` : '原画')} · ${cdn} · ${type.toUpperCase()}`, url, type, quality, cdn });
  }
  const anchorId = info.uid ?? info.lUid;
  return result(variants, { name: info.nick, title: info.introduction || info.roomName, avatar: image(info.avatar180) || image(info.avatar), cover: image(info.screenshot), category: info.gameFullName, roomId, anchorId: anchorId != null ? String(anchorId) : undefined, liveStatus: 'live' });
}

async function bilibili(roomId: string, signal?: AbortSignal): Promise<WebLivePlayback> {
  const h = { headers: headers('https://live.bilibili.com/') };
  const init = await json(`https://api.live.bilibili.com/room/v1/Room/room_init?id=${encodeURIComponent(roomId)}`, signal, h);
  if (init.code !== 0 || !init.data) throw new Error(init.message || '获取 B 站房间失败');
  const room = init.data, rid = String(room.room_id), uid = String(room.uid);
  if (room.live_status !== 1) throw new Error('直播未开启');
  const [play, owner, detail] = await Promise.all([
    json(`https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id=${encodeURIComponent(rid)}&protocol=0,1&format=0,1,2&codec=0,1&qn=10000&platform=web&ptype=8`, signal, h),
    json(`https://api.live.bilibili.com/live_user/v1/Master/info?uid=${encodeURIComponent(uid)}`, signal, h).catch(() => null),
    json(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${encodeURIComponent(rid)}`, signal, h).catch(() => null),
  ]);
  if (play.code !== 0) throw new Error(play.message || '获取 B 站播放信息失败');
  const data = play.data?.playurl_info?.playurl;
  const accepted = new Set<number>();
  let highest = 0;
  for (const stream of data?.stream || []) for (const format of stream.format || []) for (const codec of format.codec || []) {
    highest = Math.max(highest, Number(codec.current_qn) || 0);
    for (const qn of codec.accept_qn || []) if (Number.isInteger(qn)) accepted.add(qn);
  }
  const requested = Array.from(accepted).filter(qn => qn < highest).sort((a, b) => b - a).slice(0, 3);
  const lower = await Promise.all(requested.map(async qn => {
    try {
      const value = await json(`https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id=${encodeURIComponent(rid)}&protocol=0,1&format=0,1,2&codec=0,1&qn=${qn}&platform=web&ptype=8`, signal, h);
      return value.code === 0 ? { qn, data: value.data?.playurl_info?.playurl } : null;
    } catch { return null; }
  }));
  const formats: any[] = [];
  for (const item of [{ qn: 0, data }, ...lower.filter((x): x is { qn: number; data: any } => x !== null)]) {
    for (const stream of item.data?.stream || []) for (const format of stream.format || []) for (const codec of format.codec || []) {
      if (!['ts', 'fmp4', 'flv'].includes(format.format_name) || (item.qn && Number(codec.current_qn) !== item.qn)) continue;
      formats.push({ format: format.format_name, codec });
    }
  }
  formats.sort((a, b) => (a.codec.codec_name === 'avc' ? 0 : 1) - (b.codec.codec_name === 'avc' ? 0 : 1) || (Number(b.codec.current_qn) || 0) - (Number(a.codec.current_qn) || 0) || (a.format === 'ts' ? 0 : a.format === 'fmp4' ? 1 : 2) - (b.format === 'ts' ? 0 : b.format === 'fmp4' ? 1 : 2));
  const variants: WebLiveVariant[] = [];
  const perQuality: Record<string, number> = {};
  for (const { format, codec } of formats) for (const [index, item] of (codec.url_info || []).slice(0, 3).map((item: any, index: number) => [index, item] as const)) {
    const url = `${item.host || ''}${codec.base_url || ''}${item.extra || ''}`;
    if (!/^https?:\/\//i.test(url)) continue;
    const type = format === 'flv' ? 'flv' : 'hls';
    const quality = Number(codec.current_qn) || 0;
    const qualityKey = String(quality);
    if ((perQuality[qualityKey] || 0) >= 3) continue;
    perQuality[qualityKey] = (perQuality[qualityKey] || 0) + 1;
    const qualityName = data?.g_qn_desc?.find((q: any) => q.qn === quality)?.desc || `${quality}`;
    variants.push({ id: `${format}-${codec.codec_name}-${quality}-${index}`, label: `${qualityName} · ${format.toUpperCase()} · 线路${index + 1}`, url, type, quality, cdn: `线路${index + 1}` });
  }
  return result(variants.slice(0, 12), { name: owner?.code === 0 ? owner.data?.info?.uname : undefined, avatar: owner?.code === 0 ? owner.data?.info?.face : undefined, title: detail?.code === 0 ? detail.data?.title : undefined, cover: detail?.code === 0 ? detail.data?.user_cover || detail.data?.keyframe : undefined, category: detail?.code === 0 ? detail.data?.area_name : undefined, roomId: rid, anchorId: uid, liveStatus: 'live', qualityNote: '画质以平台返回的访客权限为准' });
}

async function douyin(roomId: string, signal?: AbortSignal): Promise<WebLivePlayback> {
  const h = headers('https://live.douyin.com/');
  const page = await request('https://live.douyin.com/', signal, { headers: h });
  const setCookie = page.headers.get('set-cookie') || '';
  let visitor = setCookie.match(/(?:^|,\s*)ttwid=([^;,]+)/)?.[1];
  if (!visitor) {
    const registration = await request('https://ttwid.bytedance.com/ttwid/union/register/', signal, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: 'cn', aid: 6383, need_t: 1, service: 'www.douyin.com', domain: '.douyin.com' }),
    });
    visitor = (registration.headers.get('set-cookie') || '').match(/(?:^|,\s*)ttwid=([^;,]+)/)?.[1];
  }
  if (!visitor) throw new Error('抖音未提供访客会话，可能需要平台验证');
  const params = new URLSearchParams({ aid: '6383', app_name: 'douyin_web', live_id: '1', device_platform: 'web', language: 'zh-CN', browser_language: 'zh-CN', browser_platform: 'Win32', browser_name: 'Chrome', browser_version: '120.0.0.0', web_rid: roomId });
  const data = await json(`https://live.douyin.com/webcast/room/web/enter/?${params}`, signal, { headers: { ...h, ...(visitor ? { Cookie: `ttwid=${visitor}` } : {}) } });
  if (data.status_code != null && data.status_code !== 0) throw new Error('抖音访客请求被平台拒绝');
  const room = data.data?.data?.[0], user = data.data?.user || room?.owner || {};
  if (!room) throw new Error('抖音未返回直播间信息，可能需要平台验证');
  if (room.status !== 2) throw new Error('直播未开启');
  const stream = room.stream_url || {}, variants: WebLiveVariant[] = [];
  const keys = ['ORIGIN', 'FULL_HD1', 'HD1', 'SD1', 'SD2'];
  const names: Record<string, string> = { ORIGIN: '原画', FULL_HD1: '超清', HD1: '高清', SD1: '标清', SD2: '流畅' };
  for (const type of ['hls', 'flv'] as const) {
    const map = type === 'hls' ? stream.hls_pull_url_map : stream.flv_pull_url;
    if (!map || typeof map !== 'object') continue;
    const ordered = [...keys, ...Object.keys(map).filter(k => !keys.includes(k))];
    for (const key of ordered) {
      const url = map[key];
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
      variants.push({ id: `${type}-${key}`, label: `${names[key] || key} · ${type.toUpperCase()}`, url, type, quality: Math.max(0, 5 - keys.indexOf(key)) });
    }
  }
  return result(variants, { name: user.nickname, title: room.title, avatar: image(user.avatar_thumb) || image(user.avatar_medium), cover: image(room.cover) || image(room.dynamic_cover), roomId, anchorId: String(user.id_str || user.id || room.owner_user_id_str || '' ) || undefined, liveStatus: 'live', qualityNote: '画质以平台返回的访客权限为准' });
}

async function douyu(roomId: string, signal?: AbortSignal): Promise<WebLivePlayback> {
  const h = headers('https://www.douyu.com/');
  let lookupId = roomId;
  let metadataText = (await request(`https://www.douyu.com/betard/${encodeURIComponent(lookupId)}`, signal, { headers: h })).text;
  let metadata: any;
  try { metadata = JSON.parse(metadataText); } catch { /* The vanity-room endpoint may return HTML. */ }
  if (!metadata?.room) {
    // Short vanity room numbers are not accepted by betard or the playback API.
    const page = (await request(`https://www.douyu.com/${encodeURIComponent(roomId)}`, signal, { headers: h })).text;
    const canonical = page.match(/\broomID\s*:\s*(\d+)/i)?.[1];
    if (!canonical || canonical === lookupId) throw new Error('斗鱼未返回房间信息，请确认房间可访问');
    lookupId = canonical;
    metadataText = (await request(`https://www.douyu.com/betard/${encodeURIComponent(lookupId)}`, signal, { headers: h })).text;
  }
  try { metadata = JSON.parse(metadataText); } catch { throw new Error('斗鱼未返回有效的房间信息'); }
  if (metadata.error != null && metadata.error !== 0) throw new Error('斗鱼房间信息获取失败');
  const room = metadata.room;
  if (!room) throw new Error('获取斗鱼房间信息失败');
  if (Number(room.show_status) !== 1) throw new Error('直播未开启');
  const rid = String(room.room_id || roomId);
  const did = crypto.randomBytes(16).toString('hex');
  async function play(rate: number): Promise<any> {
    const response = await request(`https://www.douyu.com/wgapi/livenc/liveweb/websec/getEncryption?did=${did}`, signal, { headers: h });
    const date = Date.parse(response.headers.get('date') || '');
    const ts = Math.floor((Number.isFinite(date) ? date : Date.now()) / 1000);
    const enc = JSON.parse(response.text);
    if (enc.error !== 0 || !enc.data) throw new Error('斗鱼签名参数获取失败');
    const { key, rand_str, enc_time, enc_data, is_special } = enc.data;
    if (typeof key !== 'string' || typeof rand_str !== 'string' || typeof enc_data !== 'string' || !Number.isInteger(enc_time) || enc_time < 0 || enc_time > 1000) throw new Error('斗鱼签名参数无效');
    let value = rand_str;
    for (let i = 0; i < enc_time; i++) value = md5(value + key);
    const auth = md5(value + key + (is_special === 1 ? '' : `${rid}${ts}`));
    const body = new URLSearchParams({ enc_data, tt: String(ts), did, auth, cdn: '', rate: String(rate), hevc: '0', fa: '0', ive: '0' });
    const responseData = await json(`https://www.douyu.com/lapi/live/getH5PlayV1/${encodeURIComponent(rid)}`, signal, { method: 'POST', headers: { ...h, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (responseData.error !== 0 || !responseData.data) throw new Error('斗鱼未返回播放地址');
    return responseData.data;
  }
  const first = await play(0);
  const seenRates = new Set<number>();
  const rates = (Array.isArray(first.multirates) ? first.multirates : [])
    .filter((r: any) => {
      if (!Number.isInteger(r.rate) || seenRates.has(r.rate)) return false;
      seenRates.add(r.rate);
      return true;
    })
    .sort((a: any, b: any) => (a.rate === 0 ? -1 : b.rate === 0 ? 1 : (Number(b.bit) || 0) - (Number(a.bit) || 0)))
    .slice(0, 5);
  const actualRate = Number.isInteger(first.rate) ? first.rate : null;
  const answers = await Promise.all(rates.filter((r: any) => r.rate !== 0 && r.rate !== actualRate).map(async (r: any) => ({ rate: r, data: await play(r.rate).catch(() => null) })));
  const defaultRate = actualRate === null ? { rate: 0, name: '平台默认（请求原画）', bit: 0 } : rates.find((r: any) => r.rate === actualRate) || { rate: actualRate, name: '平台默认', bit: 0 };
  const choices = [{ rate: defaultRate, data: first }, ...answers];
  choices.sort((a, b) => (a.rate.rate === 0 ? -1 : b.rate.rate === 0 ? 1 : (Number(b.rate.bit) || 0) - (Number(a.rate.bit) || 0)));
  const variants: WebLiveVariant[] = [];
  for (const choice of choices) {
    const url = `${choice.data?.rtmp_url || ''}/${choice.data?.rtmp_live || ''}`;
    if (!/^https?:\/\//i.test(url) || !choice.data?.rtmp_live) continue;
    const type = /\.m3u8(?:\?|$)/i.test(url) ? 'hls' : 'flv';
    variants.push({ id: `douyu-${choice.rate.rate}`, label: choice.rate.name || (choice.rate.bit ? `${choice.rate.bit}K` : '原画'), url, type, quality: Number(choice.rate.bit) || 0 });
  }
  return result(variants, { name: room.nickname, title: room.room_name, avatar: image(room.avatar), cover: image(room.room_src), category: room.cate_name, roomId: rid, anchorId: room.owner_uid != null ? String(room.owner_uid) : undefined, liveStatus: 'live', qualityNote: '画质以平台返回的访客权限为准' });
}

export async function resolveWebLivePlatform(platform: string, roomId: string, signal?: AbortSignal): Promise<WebLivePlayback> {
  if (!roomId || roomId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(roomId)) throw new Error('直播间 ID 无效');
  switch (platform) {
    case 'huya': return huya(roomId, signal);
    case 'bilibili': return bilibili(roomId, signal);
    case 'douyin': return douyin(roomId, signal);
    case 'douyu': return douyu(roomId, signal);
    default: throw new Error('不支持的平台');
  }
}
