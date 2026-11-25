export type LiveSource = { key: string; name: string; proxyMode?: 'full' | 'm3u8-only' | 'direct' };
export type LiveChannel = { id: string; tvgId?: string; name: string; logo?: string; group?: string; url: string };
export type TVPlayerSourceType = 'm3u8' | 'flv' | 'native';

export function getUrlSourceType(rawUrl: string): TVPlayerSourceType | 'unknown' {
  const lower = rawUrl.toLowerCase();
  const path = lower.split('?')[0];
  if (path.endsWith('.m3u8') || path.endsWith('.m3u') || lower.includes('.m3u8') || lower.includes('.m3u')) return 'm3u8';
  if (path.endsWith('.flv') || lower.includes('.flv?')) return 'flv';
  if (/\.(mp4|webm|ogv|ogg|mov)(\?.*)?$/.test(path)) return 'native';
  return 'unknown';
}

export async function resolveLiveUrl(rawUrl: string, source?: LiveSource | null, signal?: AbortSignal): Promise<{ url: string; type: TVPlayerSourceType }> {
  const proxyMode = source?.proxyMode || 'full';
  const sourceType = getUrlSourceType(rawUrl);

  if (sourceType === 'm3u8') {
    return {
      type: 'm3u8',
      url: proxyMode === 'direct'
        ? rawUrl
        : `/api/proxy/m3u8?url=${encodeURIComponent(rawUrl)}&moontv-source=${encodeURIComponent(source?.key || '')}${proxyMode === 'm3u8-only' ? '&allowCORS=true' : ''}`,
    };
  }
  if (sourceType === 'flv') return { type: 'flv', url: rawUrl };
  if (sourceType === 'native') return { type: 'native', url: rawUrl };

  if (!source?.key) throw new Error('未知直播流格式');

  const precheckRes = await fetch(
    `/api/live/precheck?url=${encodeURIComponent(rawUrl)}&moontv-source=${encodeURIComponent(source.key)}`,
    { cache: 'no-store', signal }
  );
  if (!precheckRes.ok) throw new Error('不支持的直播流格式');
  const precheck = await precheckRes.json();

  if (precheck?.type === 'flv') return { type: 'flv', url: rawUrl };
  if (precheck?.type === 'mp4') return { type: 'native', url: rawUrl };
  if (precheck?.type === 'm3u8') {
    return {
      type: 'm3u8',
      url: proxyMode === 'direct'
        ? rawUrl
        : `/api/proxy/m3u8?url=${encodeURIComponent(rawUrl)}&moontv-source=${encodeURIComponent(source.key)}${proxyMode === 'm3u8-only' ? '&allowCORS=true' : ''}`,
    };
  }

  throw new Error('不支持的直播流格式');
}

