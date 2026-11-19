import 'server-only';

import { load } from 'cheerio';

import { getWebLiveRoomUrl, type WebLivePlayback, webLiveImageUrl } from '@/lib/web-live';
import { fetchPublicMedia } from '@/lib/web-live-server';

async function page(url: string, signal?: AbortSignal): Promise<string> {
  const { response, dispose } = await fetchPublicMedia(url, { signal });
  const timer = setTimeout(dispose, 12000);
  try {
    if (!response.ok) throw new Error('无法获取平台公开资料');
    return await response.text();
  } finally { clearTimeout(timer); dispose(); }
}

function embeddedJson(html: string, name: string): any {
  const marker = new RegExp(`(?:var\\s+)?${name}\\s*=\\s*`);
  const match = marker.exec(html);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const character = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function channelAvatar(html: string): string {
  const data = embeddedJson(html, 'ytInitialData');
  const thumbnails = data?.metadata?.channelMetadataRenderer?.avatar?.thumbnails ||
    data?.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails ||
    data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
  return webLiveImageUrl(thumbnails?.[thumbnails.length - 1]?.url);
}

export async function resolveWebLiveEmbed(platform: string, roomId: string, hostname: string, signal?: AbortSignal): Promise<WebLivePlayback> {
  const officialUrl = getWebLiveRoomUrl(platform, roomId);
  if (platform === 'twitch') {
    const embed = new URL('https://player.twitch.tv/');
    embed.searchParams.set('channel', roomId);
    embed.searchParams.set('parent', hostname);
    embed.searchParams.set('autoplay', 'true');
    let name = roomId, avatar = '', title = roomId;
    try {
      const $ = load(await page(officialUrl, signal));
      name = $('meta[property="og:profile:username"]').attr('content') || roomId;
      title = ($('meta[property="og:title"]').attr('content') || $('title').text() || name).replace(/\s*[-–]\s*Twitch$/i, '');
      if (!title.trim() || title.trim().toLowerCase() === 'twitch') title = name;
      avatar = webLiveImageUrl($('meta[property="og:image"]').attr('content'));
    } catch { /* Metadata must not prevent the official player from opening. */ }
    return { kind: 'embed', url: embed.href, embedUrl: embed.href, originalUrl: officialUrl, name, title, avatar, anchorId: roomId, roomId, liveStatus: 'unknown', qualityNote: '画质在 Twitch 播放器内选择，实际选项由平台提供' };
  }

  let videoId = /^[\w-]{11}$/.test(roomId) ? roomId : '';
  let details: any = null;
  let html = '';
  try {
    html = await page(officialUrl, signal);
    const player = embeddedJson(html, 'ytInitialPlayerResponse');
    details = player?.videoDetails;
    if (!videoId) {
      if (details?.videoId && /^[\w-]{11}$/.test(details.videoId)) videoId = details.videoId;
      else {
        const canonical = load(html)('link[rel="canonical"]').attr('href');
        const candidate = canonical ? new URL(canonical, officialUrl).searchParams.get('v') : '';
        if (candidate && /^[\w-]{11}$/.test(candidate)) videoId = candidate;
      }
    }
  } catch { /* A supplied video ID can still use the official embed. */ }
  if (!videoId) throw new Error('未找到频道当前公开直播，请填写具体的 YouTube 直播视频链接');
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  let oembed: any = null;
  try { oembed = JSON.parse(await page(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`, signal)); } catch { /* Optional metadata. */ }
  let avatar = channelAvatar(html);
  if (!avatar && oembed?.author_url) {
    try {
      const authorUrl = new URL(oembed.author_url);
      if (authorUrl.hostname === 'www.youtube.com' || authorUrl.hostname === 'youtube.com') avatar = channelAvatar(await page(authorUrl.href, signal));
    } catch { /* Keep a neutral fallback when channel artwork is unavailable. */ }
  }
  const embed = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
  embed.searchParams.set('autoplay', '1');
  embed.searchParams.set('playsinline', '1');
  const thumbnails = details?.thumbnail?.thumbnails;
  return {
    kind: 'embed', url: embed.href, embedUrl: embed.href, originalUrl: watchUrl,
    name: details?.author || oembed?.author_name, title: details?.title || oembed?.title,
    avatar, cover: webLiveImageUrl(thumbnails?.[thumbnails.length - 1]?.url || oembed?.thumbnail_url),
    roomId: videoId, anchorId: details?.channelId || (roomId.startsWith('channel:') ? roomId.slice(8) : roomId.startsWith('@') ? roomId : undefined),
    liveStatus: 'unknown', qualityNote: '画质在 YouTube 播放器内选择，是否允许嵌入由频道决定',
  };
}
