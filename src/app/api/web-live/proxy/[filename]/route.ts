import { NextRequest, NextResponse } from 'next/server';

import { requireFeaturePermission } from '@/lib/permissions';
import { fetchPublicMedia, platformReferer, readMediaTicket, webLiveProxyUrl } from '@/lib/web-live-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function rewritePlaylist(content: string, base: string, platform: string, username: string, root: string, expires: number): string {
  const rewrite = (value: string) => {
    if (value.startsWith('data:')) return value;
    const target = new URL(value, base);
    return webLiveProxyUrl(target.href, platform, username, root, expires);
  };
  return content.split('\n').map((line) => {
    const value = line.trim();
    if (!value) return line;
    if (value.startsWith('#')) return line.replace(/(\bURI\s*=\s*)"([^"]+)"/g, (_match, prefix: string, uri: string) => prefix + '"' + rewrite(uri) + '"');
    return rewrite(value);
  }).join('\n');
}

export async function GET(request: NextRequest) {
  const auth = await requireFeaturePermission(request, 'web_live', '无权限访问网络直播');
  if (auth instanceof NextResponse) return auth;
  let ticket: ReturnType<typeof readMediaTicket>;
  try { ticket = readMediaTicket(request.nextUrl.searchParams.get('ticket') || '', auth.username); }
  catch { return NextResponse.json({ error: '直播链接已失效，请重新打开直播间' }, { status: 403 }); }
  let cleanup: (() => void) | undefined;
  try {
    const headers: Record<string, string> = {};
    const referer = platformReferer(ticket.p);
    if (referer) headers.Referer = referer;
    const range = request.headers.get('range');
    if (range) {
      if (!/^bytes=\d*-\d*$/.test(range)) return NextResponse.json({ error: '无效的分段请求' }, { status: 400 });
      headers.Range = range;
      const ifRange = request.headers.get('if-range');
      if (ifRange) headers['If-Range'] = ifRange;
    }
    const { response, dispose } = await fetchPublicMedia(ticket.u, { signal: request.signal, headers });
    cleanup = dispose;
    if (!response.ok) {
      response.body?.destroy();
      dispose();
      return NextResponse.json({ error: '上游直播连接失败，请刷新线路', upstreamStatus: response.status }, { status: response.status === 403 || response.status === 404 ? response.status : 502 });
    }
    const finalUrl = response.url || ticket.u;
    const contentType = response.headers.get('content-type') || '';
    const isPlaylist = /\.m3u8$/i.test(new URL(ticket.u).pathname) || /\.m3u8$/i.test(new URL(finalUrl).pathname) || /mpegurl/i.test(contentType);
    if (isPlaylist) {
      const timer = setTimeout(dispose, 15000);
      try {
        const body = (await response.text()).trimStart();
        if (!body.startsWith('#EXTM3U')) throw new Error('上游没有返回有效直播清单');
        return new NextResponse(rewritePlaylist(body, finalUrl, ticket.p, auth.username, ticket.r, ticket.e), {
          headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
        });
      } finally { clearTimeout(timer); dispose(); }
    }
    if (/text\/html|application\/(?:json|javascript)|image\/svg/i.test(contentType)) {
      response.body?.destroy(); dispose();
      return NextResponse.json({ error: '上游未返回媒体数据' }, { status: 502 });
    }
    const upstream = response.body;
    if (!upstream) { dispose(); throw new Error('没有直播数据'); }
    const iterator = upstream[Symbol.asyncIterator]();
    let idle: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idle);
      idle = setTimeout(() => { upstream.destroy(new Error('直播上游响应超时')); dispose(); }, 30000);
    };
    resetIdle();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const part = await iterator.next();
          if (part.done) { clearTimeout(idle); dispose(); controller.close(); return; }
          resetIdle();
          controller.enqueue(new Uint8Array(part.value));
        } catch {
          clearTimeout(idle); dispose(); controller.error(new Error('直播连接中断'));
        }
      },
      cancel() { clearTimeout(idle); upstream.destroy(); dispose(); },
    });
    const outputHeaders = new Headers({ 'Content-Type': contentType || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const name of ['Content-Range', 'Accept-Ranges']) {
      const value = response.headers.get(name);
      if (value) outputHeaders.set(name, value);
    }
    return new NextResponse(stream, { status: response.status, headers: outputHeaders });
  } catch {
    cleanup?.();
    return NextResponse.json({ error: '直播代理请求失败，请刷新线路或前往官方直播间' }, { status: 502 });
  }
}
