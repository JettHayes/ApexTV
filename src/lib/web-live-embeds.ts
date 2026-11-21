import 'server-only';

import { load } from 'cheerio';

import {
  getWebLiveRoomUrl,
  normalizeWebLiveRoomId,
  type WebLivePlayback,
  webLiveImageUrl,
} from '@/lib/web-live';
import { fetchPublicMedia } from '@/lib/web-live-server';

async function page(url: string, signal?: AbortSignal): Promise<string> {
  const { response, dispose } = await fetchPublicMedia(url, { signal });
  const timer = setTimeout(dispose, 12000);
  try {
    if (!response.ok) throw new Error('无法获取平台公开资料');
    return await response.text();
  } finally {
    clearTimeout(timer);
    dispose();
  }
}

function embeddedJson(html: string, name: string): any {
  const marker = new RegExp(`(?:var\\s+)?${name}\\s*=\\s*`);
  const match = marker.exec(html);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < html.length; i++) {
    const character = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function channelAvatar(html: string): string {
  const data = embeddedJson(html, 'ytInitialData');
  const thumbnails =
    data?.metadata?.channelMetadataRenderer?.avatar?.thumbnails ||
    data?.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails ||
    data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.image
      ?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
  return webLiveImageUrl(thumbnails?.[thumbnails.length - 1]?.url);
}

interface YouTubeSnapshot {
  live: boolean;
  videoId: string;
  channelId: string;
  name?: string;
  title?: string;
  avatar?: string;
  cover?: string;
}

const youtubeVideoId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w-]{11}$/.test(value);
const youtubeChannelId = (value: unknown): value is string =>
  typeof value === 'string' && /^UC[\w-]{22}$/.test(value);

function youtubeSnapshot(html: string): YouTubeSnapshot {
  const player = embeddedJson(html, 'ytInitialPlayerResponse');
  const data = embeddedJson(html, 'ytInitialData');
  const details = player?.videoDetails;
  const broadcast =
    player?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
  const contents =
    data?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
  const primary = contents.find(
    (item: any) => item.videoPrimaryInfoRenderer
  )?.videoPrimaryInfoRenderer;
  const owner = contents.find((item: any) => item.videoSecondaryInfoRenderer)
    ?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;
  const channel = data?.metadata?.channelMetadataRenderer;
  const id =
    details?.videoId || data?.currentVideoEndpoint?.watchEndpoint?.videoId;
  const ownerId =
    details?.channelId ||
    owner?.navigationEndpoint?.browseEndpoint?.browseId ||
    channel?.externalId;
  const offline =
    player?.playabilityStatus?.status === 'LIVE_STREAM_OFFLINE' ||
    details?.isUpcoming === true ||
    !!broadcast?.endTimestamp;
  const live =
    !offline &&
    (broadcast?.isLiveNow === true ||
      details?.isLive === true ||
      primary?.viewCount?.videoViewCountRenderer?.isLive === true);
  const thumbnails = details?.thumbnail?.thumbnails;
  return {
    live,
    videoId: youtubeVideoId(id) ? id : '',
    channelId: youtubeChannelId(ownerId) ? ownerId : '',
    name:
      details?.author ||
      owner?.title?.runs?.map((item: any) => item.text || '').join('') ||
      channel?.title,
    title:
      details?.title ||
      primary?.title?.runs?.map((item: any) => item.text || '').join(''),
    avatar:
      channelAvatar(html) ||
      webLiveImageUrl(owner?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url),
    cover: webLiveImageUrl(
      thumbnails?.slice(-1)?.[0]?.url ||
        load(html)('meta[property="og:image"]').attr('content')
    ),
  };
}

function youtubeAuthorLocator(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    return normalizeWebLiveRoomId('youtube', value);
  } catch {
    return '';
  }
}

async function resolveYouTubeLive(
  roomId: string,
  signal?: AbortSignal
): Promise<WebLivePlayback> {
  let locator = roomId;
  let authorName: string | undefined;
  if (youtubeVideoId(roomId)) {
    // 视频 ID 标识单场节目；只用它识别作者，播放始终跟随频道当前直播。
    try {
      const watch =
        'https://www.youtube.com/watch?v=' + encodeURIComponent(roomId);
      const data = JSON.parse(
        await page(
          'https://www.youtube.com/oembed?url=' +
            encodeURIComponent(watch) +
            '&format=json',
          signal
        )
      );
      const author = youtubeAuthorLocator(data.author_url);
      if (author.startsWith('@') || author.startsWith('channel:'))
        locator = author;
      authorName =
        typeof data.author_name === 'string' ? data.author_name : undefined;
    } catch {
      /* 部分旧视频不提供 oEmbed，尝试公开页面中的频道标识。 */
    }
    if (locator === roomId) {
      const previous = youtubeSnapshot(
        await page(getWebLiveRoomUrl('youtube', roomId), signal)
      );
      if (!previous.channelId)
        throw new Error(
          '无法识别视频所属频道，请改填 YouTube 频道链接或 @handle'
        );
      locator = 'channel:' + previous.channelId;
      authorName = previous.name;
    }
  }

  const channelUrl = getWebLiveRoomUrl('youtube', locator);
  const snapshot = youtubeSnapshot(await page(channelUrl, signal));
  if (!snapshot.channelId)
    throw new Error('暂时无法确认频道直播状态，请稍后重试');
  const identity =
    snapshot.channelId ||
    (locator.startsWith('channel:') ? locator.slice(8) : locator);
  if (!snapshot.live || !snapshot.videoId) {
    return {
      kind: 'embed',
      url: '',
      originalUrl: channelUrl,
      name: snapshot.name || authorName,
      title: snapshot.name || authorName,
      avatar: snapshot.avatar,
      anchorId: identity,
      roomId: locator,
      liveStatus: 'offline',
      qualityNote: '频道当前未开播，开播后自动连接',
    };
  }

  const embed = new URL(
    'https://www.youtube.com/embed/' + encodeURIComponent(snapshot.videoId)
  );
  embed.searchParams.set('autoplay', '1');
  embed.searchParams.set('playsinline', '1');
  return {
    kind: 'embed',
    url: embed.href,
    embedUrl: embed.href,
    originalUrl:
      'https://www.youtube.com/watch?v=' + encodeURIComponent(snapshot.videoId),
    name: snapshot.name || authorName,
    title: snapshot.title,
    avatar: snapshot.avatar,
    cover: snapshot.cover,
    roomId: snapshot.videoId,
    anchorId: identity,
    liveStatus: 'live',
    qualityNote: '画质在 YouTube 播放器内选择，是否允许嵌入由频道决定',
  };
}

/** 保存新配置时转换为固定频道 ID，避免长期依赖某一场节目。 */
export async function normalizeYouTubeChannel(
  value: string,
  signal?: AbortSignal
): Promise<string> {
  const room = normalizeWebLiveRoomId('youtube', value);
  const result = await resolveYouTubeLive(room, signal);
  if (!youtubeChannelId(result.anchorId))
    throw new Error('无法确认 YouTube 频道，请填写有效的频道链接或 @handle');
  return 'channel:' + result.anchorId;
}

export async function resolveWebLiveEmbed(
  platform: string,
  roomId: string,
  hostname: string,
  signal?: AbortSignal
): Promise<WebLivePlayback> {
  const officialUrl = getWebLiveRoomUrl(platform, roomId);
  if (platform === 'twitch') {
    const embed = new URL('https://player.twitch.tv/');
    embed.searchParams.set('channel', roomId);
    embed.searchParams.set('parent', hostname);
    embed.searchParams.set('autoplay', 'true');
    let name = roomId,
      avatar = '',
      title = roomId;
    try {
      const $ = load(await page(officialUrl, signal));
      name =
        $('meta[property="og:profile:username"]').attr('content') || roomId;
      title = (
        $('meta[property="og:title"]').attr('content') ||
        $('title').text() ||
        name
      ).replace(/\s*[-–]\s*Twitch$/i, '');
      if (!title.trim() || title.trim().toLowerCase() === 'twitch')
        title = name;
      avatar = webLiveImageUrl($('meta[property="og:image"]').attr('content'));
    } catch {
      /* Metadata must not prevent the official player from opening. */
    }
    return {
      kind: 'embed',
      url: embed.href,
      embedUrl: embed.href,
      originalUrl: officialUrl,
      name,
      title,
      avatar,
      anchorId: roomId,
      roomId,
      liveStatus: 'unknown',
      qualityNote: '画质在 Twitch 播放器内选择，实际选项由平台提供',
    };
  }

  return resolveYouTubeLive(roomId, signal);
}
