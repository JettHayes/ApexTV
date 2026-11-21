import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { requireFeaturePermission } from '@/lib/permissions';
import {
  isWebLivePlatformEnabled,
  normalizeWebLiveRoomId,
  type WebLivePlayback,
  type WebLiveSource,
  webLiveImageUrl,
} from '@/lib/web-live';
import { resolveWebLiveEmbed } from '@/lib/web-live-embeds';
import { WebLiveResolveError } from '@/lib/web-live-errors';
import { resolveWebLivePlatform } from '@/lib/web-live-resolvers';
import {
  fetchPublicMedia,
  validatePublicMediaUrl,
  webLiveProxyUrl,
} from '@/lib/web-live-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function customPlayback(
  source: WebLiveSource,
  signal: AbortSignal
): Promise<WebLivePlayback> {
  const url = normalizeWebLiveRoomId('custom', source.roomId);
  await validatePublicMediaUrl(url);
  let type: 'hls' | 'flv' | undefined =
    source.streamFormat === 'hls' || source.streamFormat === 'flv'
      ? source.streamFormat
      : undefined;
  if (!type) {
    const path = new URL(url).pathname;
    if (/\.m3u8$/i.test(path)) type = 'hls';
    else if (/\.flv$/i.test(path)) type = 'flv';
    else {
      const { response, dispose } = await fetchPublicMedia(url, {
        signal,
        headers: { Range: 'bytes=0-1023' },
      });
      try {
        if (response.status === 401 || response.status === 403)
          throw new WebLiveResolveError(
            'CUSTOM_URL_EXPIRED',
            '自定义地址已失效或访问被拒绝，请更新源地址',
            false
          );
        if (!response.ok)
          throw new WebLiveResolveError(
            'NETWORK_ERROR',
            '无法连接自定义直播地址'
          );
        const contentType = response.headers.get('content-type') || '';
        if (/mpegurl/i.test(contentType)) type = 'hls';
        else if (/flv/i.test(contentType)) type = 'flv';
      } finally {
        response.body?.destroy();
        dispose();
      }
    }
  }
  if (!type)
    throw new WebLiveResolveError(
      'UNAVAILABLE',
      '无法识别直播格式，请在后台为该地址指定 HLS 或 FLV',
      false
    );
  return {
    kind: 'stream',
    url,
    type,
    originalUrl: url,
    name: source.name,
    title: source.name,
    liveStatus: 'unknown',
    variants: [{ id: 'source', label: type.toUpperCase(), url, type }],
    qualityNote:
      '画质由源地址提供；HLS 多码率可自适应。带签名的临时地址可能过期，需要更新，系统无法替外部源续签。',
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireFeaturePermission(
    request,
    'web_live',
    '无权限访问网络直播'
  );
  if (auth instanceof NextResponse) return auth;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (request.signal.aborted) abort();
  else request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 45000);
  try {
    const params = request.nextUrl.searchParams;
    const platform = params.get('platform')?.trim() || '';
    if (!isWebLivePlatformEnabled(platform))
      return NextResponse.json({ error: '不支持此直播平台' }, { status: 400 });
    let roomId: string;
    try {
      roomId = normalizeWebLiveRoomId(platform, params.get('roomId') || '');
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '房间参数无效' },
        { status: 400 }
      );
    }
    const config = await getConfig();
    if (config?.WebLiveEnabled === false)
      return NextResponse.json(
        { error: '网络直播功能已停用' },
        { status: 403 }
      );
    const sourceKey = params.get('sourceKey');
    const statusOnly = params.get('probe') === '1';
    const source = config?.WebLiveConfig?.find((item) => {
      if (
        item.disabled ||
        item.platform !== platform ||
        (sourceKey && item.key !== sourceKey)
      )
        return false;
      try {
        return normalizeWebLiveRoomId(item.platform, item.roomId) === roomId;
      } catch {
        return false;
      }
    });
    if ((sourceKey && !source) || (platform === 'custom' && !source))
      return NextResponse.json(
        { error: '直播源不存在或已停用' },
        { status: 404 }
      );
    const result =
      platform === 'youtube' || platform === 'twitch'
        ? await resolveWebLiveEmbed(
            platform,
            roomId,
            request.nextUrl.hostname,
            controller.signal
          )
        : platform === 'custom'
        ? await customPlayback(source!, controller.signal)
        : await resolveWebLivePlatform(
            platform,
            roomId,
            controller.signal,
            statusOnly
          );
    result.avatar = webLiveImageUrl(source?.avatar || result.avatar);
    result.cover = webLiveImageUrl(source?.cover || result.cover);
    result.name = result.name || source?.name;
    result.roomId =
      result.roomId || (platform === 'custom' ? undefined : roomId);
    if (
      result.kind === 'stream' &&
      result.url &&
      result.liveStatus !== 'offline'
    ) {
      const original = result.url;
      const variants = result.variants?.length
        ? result.variants
        : [
            {
              id: 'default',
              label: '默认线路',
              url: original,
              type: result.type || ('hls' as const),
            },
          ];
      result.variants = variants.map((variant) => ({
        ...variant,
        url: webLiveProxyUrl(variant.url, platform, auth.username),
      }));
      result.url = result.variants[0].url;
      result.type = result.variants[0].type;
      result.originalUrl = original;
    }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    const message = error instanceof Error ? error.message : '';
    const safeMessage =
      /[\u4e00-\u9fff]/.test(message) && !/https?:\/\//i.test(message)
        ? message
        : '获取直播信息失败，请稍后重试';
    const code =
      error instanceof WebLiveResolveError ? error.code : 'NETWORK_ERROR';
    const retryable =
      error instanceof WebLiveResolveError ? error.retryable : true;
    return NextResponse.json(
      { error: safeMessage, code, retryable },
      {
        status: code === 'PLATFORM_RESTRICTED' ? 503 : 502,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
  }
}
