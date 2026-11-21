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
  qualityLabel?: string;
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
  { enabled: true, value: 'huya', label: '虎牙', kind: 'stream', inputLabel: '直播间链接或房间标识', placeholder: 'https://www.huya.com/直播间标识', help: '粘贴虎牙直播间完整链接，或填写直播间路径中的标识。' },
  { enabled: true, value: 'bilibili', label: '哔哩哔哩', kind: 'stream', inputLabel: '直播间链接或房间号', placeholder: 'https://live.bilibili.com/房间号', help: '粘贴 B 站直播间链接，或填写数字房间号；不支持个人空间和视频链接。' },
  { enabled: true, value: 'douyin', label: '抖音', kind: 'stream', inputLabel: '网页直播间链接或房间号', placeholder: 'https://live.douyin.com/房间号', help: '填写网页直播间链接或其中的数字房间号；分享短链接请先在浏览器打开，复制直播间地址。' },
  { enabled: true, value: 'douyu', label: '斗鱼', kind: 'stream', inputLabel: '直播间链接或房间号', placeholder: 'https://www.douyu.com/房间号', help: '粘贴斗鱼直播间链接，或填写数字房间号。' },
  { enabled: true, value: 'youtube', label: 'YouTube Live', kind: 'embed', inputLabel: '频道链接、@handle 或直播视频链接', placeholder: 'https://www.youtube.com/@频道handle/live', help: '推荐频道链接或 @handle；保存时会统一转换成固定频道；直播视频链接用于识别作者，下播后等待下一场，不播放历史回放。使用官方播放器，受嵌入权限及网络影响。' },
  { enabled: true, value: 'twitch', label: 'Twitch', kind: 'embed', inputLabel: '频道链接或频道名', placeholder: 'https://www.twitch.tv/频道名', help: '填写频道链接或频道名；不支持视频、目录或设置页面链接。使用官方播放器。' },
  { enabled: true, value: 'custom', label: '自定义直播地址', kind: 'stream', inputLabel: '直播流网址', placeholder: 'https://example.com/live/index.m3u8', help: '填写自己持有或获授权的公网 HLS / FLV 地址，无后缀地址请指定格式；临时签名地址过期后需手动更新。' },
] as const;

export function isWebLivePlatformEnabled(platform: string): boolean {
  return WEB_LIVE_PLATFORMS.some((item) => item.value === platform && item.enabled);
}

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
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('请填写不含账号凭据的 HTTP 或 HTTPS 链接');
    const host = url.hostname.toLowerCase();
    let paths: string[];
    try { paths = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); }
    catch { throw new Error('链接格式无效'); }
    const isHost = (...hosts: string[]) => hosts.includes(host);
    const invalid = () => { throw new Error(`请填写有效的${webLivePlatformName(platform)}直播链接`); };
    if (platform === 'youtube') {
      if (isHost('youtu.be', 'www.youtu.be') && paths.length === 1) id = paths[0];
      else if (isHost('youtube.com', 'www.youtube.com', 'm.youtube.com')) {
        if (paths.length === 1 && paths[0] === 'watch') id = url.searchParams.get('v') || '';
        else if (paths.length === 2 && paths[0] === 'live') id = paths[1];
        else if ((paths.length === 1 || paths.length === 2 && paths[1] === 'live') && paths[0]?.startsWith('@')) id = paths[0];
        else if ((paths.length === 2 || paths.length === 3 && paths[2] === 'live') && paths[0] === 'channel') id = `channel:${paths[1]}`;
        else invalid();
      } else invalid();
    } else {
      const hosts: Record<string, string[]> = {
        huya: ['huya.com', 'www.huya.com', 'm.huya.com'],
        bilibili: ['live.bilibili.com'],
        douyin: ['live.douyin.com'],
        douyu: ['douyu.com', 'www.douyu.com', 'm.douyu.com'],
        twitch: ['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'],
      };
      if (!hosts[platform]?.includes(host) || paths.length !== 1) invalid();
      id = paths[0];
    }
  }
  const patterns: Record<string, RegExp> = {
    huya: /^[a-zA-Z0-9_-]{1,128}$/,
    bilibili: /^\d{1,24}$/,
    douyin: /^\d{1,24}$/,
    douyu: /^\d{1,24}$/,
    twitch: /^[a-zA-Z0-9_]{1,25}$/,
    youtube: /^(?:[a-zA-Z0-9_-]{11}|@[^\s/?#]{1,100}|channel:UC[a-zA-Z0-9_-]{22})$/,
  };
  if (platform === 'twitch' && new Set(['videos', 'video', 'directory', 'settings', 'search', 'downloads', 'subscriptions', 'inventory', 'jobs', 'p', 'turbo', 'wallet', 'login', 'signup']).has(id.toLowerCase())) throw new Error('请填写 Twitch 频道名或频道链接');
  if (!patterns[platform].test(id)) throw new Error(`请检查${webLivePlatformName(platform)}的房间号或链接格式`);
  return platform === 'twitch' ? id.toLowerCase() : id;
}

export function webLiveSourceLabel(source: Pick<WebLiveSource, 'platform' | 'roomId'>): string {
  if (source.platform === 'custom') return '自定义直播源';
  if (source.platform === 'youtube') {
    if (source.roomId.startsWith('channel:')) return '频道 ' + source.roomId.slice(8);
    if (source.roomId.startsWith('@')) return '频道 ' + source.roomId;
    return '视频入口 ' + source.roomId;
  }
  if (source.platform === 'twitch') return '频道 ' + source.roomId;
  return '房间 ' + source.roomId;
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
  const origins: Record<string, string> = { huya: 'https://www.huya.com/', bilibili: 'https://live.bilibili.com/', douyin: 'https://live.douyin.com/', douyu: 'https://www.douyu.com/', twitch: 'https://www.twitch.tv/' };
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
