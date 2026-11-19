export interface WebLiveRoomInfo {
  name?: string;
  title?: string;
  avatar?: string;
  cover?: string;
  category?: string;
  roomId?: string;
  anchorId?: string;
  liveStatus?: 'live' | 'offline' | 'unknown';
}

export interface WebLiveVariant {
  id: string;
  label: string;
  url: string;
  type: 'hls' | 'flv';
  quality?: number;
  cdn?: string;
}

export interface WebLivePlayback extends WebLiveRoomInfo {
  kind: 'stream' | 'embed';
  url: string;
  originalUrl?: string;
  type?: 'hls' | 'flv';
  variants?: WebLiveVariant[];
  qualityNote?: string;
  embedUrl?: string;
}

export interface WebLiveSource {
  key: string;
  name: string;
  platform: string;
  roomId: string;
  from: string;
  disabled?: boolean;
  streamFormat?: 'auto' | 'hls' | 'flv';
  avatar?: string;
  cover?: string;
}

export const WEB_LIVE_PLATFORMS = [
  { value: 'huya', label: '虎牙', kind: 'stream', placeholder: '998 或虎牙直播间链接', help: '支持房间号和直播间链接，自动选择当前访客可用画质。' },
  { value: 'bilibili', label: '哔哩哔哩', kind: 'stream', placeholder: '35 或 B 站直播间链接', help: '支持短房间号和真实房间号，画质以访客实际可用范围为准。' },
  { value: 'douyin', label: '抖音', kind: 'stream', placeholder: '网页直播间号或 live.douyin.com 链接', help: '填写网页直播间地址中的号码，不是抖音账号；短分享链接请先在浏览器打开。' },
  { value: 'douyu', label: '斗鱼', kind: 'stream', placeholder: '房间号或 douyu.com 直播间链接', help: '支持公开直播间，画质和线路以平台当前返回结果为准。' },
  { value: 'kuaishou', label: '快手', kind: 'stream', placeholder: '主播 ID 或 live.kuaishou.com/u/…', help: '解析公开网页直播；遇到平台登录或风控要求时，可前往官方直播间观看。' },
  { value: 'custom', label: '自定义直播地址', kind: 'stream', placeholder: 'https://example.com/live/index.m3u8', help: '填写自己持有或获授权的公网 HLS / FLV 地址，无后缀地址请指定格式。' },
  { value: 'youtube', label: 'YouTube Live', kind: 'embed', placeholder: '直播视频链接、视频 ID 或 @频道名', help: '使用 YouTube 官方播放器，画质在播放器中选择；受频道嵌入权限和设备网络影响。' },
  { value: 'twitch', label: 'Twitch', kind: 'embed', placeholder: '频道名或 twitch.tv/频道名', help: '使用 Twitch 官方播放器，画质和账号限制由平台控制。' },
] as const;

export function webLivePlatformName(platform: string): string {
  return WEB_LIVE_PLATFORMS.find((item) => item.value === platform)?.label || platform;
}

export function normalizeWebLiveRoomId(platform: string, value: string): string {
  if (!WEB_LIVE_PLATFORMS.some((item) => item.value === platform)) throw new Error('不支持的直播平台');
  let id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 4096) throw new Error('请输入有效的房间号或直播地址');
  let url: URL | null = null;
  try { url = new URL(id.startsWith('www.') ? `https://${id}` : id); } catch { /* 输入也可以是房间号。 */ }
  if (platform === 'custom') {
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('直播地址必须是无用户名和密码的 HTTP / HTTPS 公网地址');
    url.hash = '';
    return url.href;
  }
  if (url && !(platform === 'youtube' && id.startsWith('channel:'))) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('不支持此链接协议');
    const host = url.hostname.toLowerCase();
    const paths = url.pathname.split('/').filter(Boolean);
    const matchHost = (domain: string) => host === domain || host.endsWith(`.${domain}`);
    const domains: Record<string, string> = { huya: 'huya.com', bilibili: 'bilibili.com', douyin: 'douyin.com', douyu: 'douyu.com', kuaishou: 'kuaishou.com', twitch: 'twitch.tv' };
    if (platform === 'youtube') {
      if (host === 'youtu.be') id = paths[0] || '';
      else if (matchHost('youtube.com')) {
        if (paths[0]?.startsWith('@')) id = decodeURIComponent(paths[0]);
        else if (paths[0] === 'channel') id = `channel:${paths[1] || ''}`;
        else id = url.searchParams.get('v') || (['live', 'embed', 'shorts'].includes(paths[0]) ? paths[1] : '') || '';
      } else throw new Error('请填写 YouTube 视频或频道链接');
    } else {
      if (!matchHost(domains[platform])) throw new Error(`请填写${webLivePlatformName(platform)}的直播间链接`);
      id = platform === 'kuaishou' && paths[0] === 'u' ? paths[1] || '' : platform === 'douyu' && paths[0] === 'topic' ? paths[1] || '' : paths[0] || '';
    }
  }
  const patterns: Record<string, RegExp> = {
    huya: /^[a-zA-Z0-9_-]{1,128}$/,
    bilibili: /^\d{1,24}$/,
    douyin: /^\d{1,24}$/,
    douyu: /^\d{1,24}$/,
    kuaishou: /^[a-zA-Z0-9_-]{1,128}$/,
    twitch: /^[a-zA-Z0-9_]{1,25}$/,
    youtube: /^(?:[a-zA-Z0-9_-]{11}|@[^\s/?#]{1,100}|channel:UC[a-zA-Z0-9_-]{22})$/,
  };
  if (!patterns[platform].test(id)) throw new Error(`请检查${webLivePlatformName(platform)}的房间号或链接格式`);
  return platform === 'twitch' ? id.toLowerCase() : id;
}

export function getWebLiveRoomUrl(platform: string, roomId: string): string {
  let id: string;
  try { id = normalizeWebLiveRoomId(platform, roomId); } catch { return ''; }
  if (platform === 'custom') return id;
  if (platform === 'youtube') {
    if (id.startsWith('@')) return `https://www.youtube.com/${encodeURIComponent(id)}/live`;
    if (id.startsWith('channel:')) return `https://www.youtube.com/channel/${encodeURIComponent(id.slice(8))}/live`;
    return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  }
  const origins: Record<string, string> = { huya: 'https://www.huya.com/', bilibili: 'https://live.bilibili.com/', douyin: 'https://live.douyin.com/', douyu: 'https://www.douyu.com/', kuaishou: 'https://live.kuaishou.com/u/', twitch: 'https://www.twitch.tv/' };
  return `${origins[platform]}${encodeURIComponent(id)}`;
}

// Platform artwork sometimes uses HTTP; keep images safe on an HTTPS page.
export function webLiveImageUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return '';
    url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
}
