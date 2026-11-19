import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';
import { lookup } from 'dns/promises';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { isIP } from 'net';
import fetch, { type Response } from 'node-fetch';
import type { Readable } from 'stream';

type MediaResponse = Omit<Response, 'body'> & { readonly body: Readable | null };

export const WEB_LIVE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) || address === '168.63.129.16');
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    const first = parseInt(value.split(':')[0], 16);
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 &&
      !/^2001:(?:0*:|0*2:|0*db8:)/i.test(value);
  }
  return false;
}

export async function validatePublicMediaUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('仅支持无账户凭据的公网 HTTP / HTTPS 地址');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.') && !isIP(host)) throw new Error('不支持内网或本机直播地址');
  let addresses: { address: string; family: number }[];
  if (isIP(host)) addresses = [{ address: host, family: isIP(host) }];
  else {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      addresses = await Promise.race([
        lookup(host, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('直播地址解析超时')), 5000); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }
  if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) throw new Error('直播地址必须解析到公网地址');
  return { url, address: addresses.find((entry) => entry.family === 4) || addresses[0] };
}

// Pin the validated address while retaining the original hostname for Host and TLS.
export async function fetchPublicMedia(value: string, options: {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  allowedOrigins?: string[];
} = {}): Promise<{ response: MediaResponse; dispose: () => void }> {
  let target = value;
  for (let hop = 0; hop < 5; hop++) {
    const { url, address } = await validatePublicMediaUrl(target);
    if (options.allowedOrigins && !options.allowedOrigins.includes(url.origin)) throw new Error('直播跳转到了未经允许的来源');
    const pinnedLookup = (_hostname: string, lookupOptions: any, callback: any) => {
      if (lookupOptions?.all) callback(null, [address]);
      else callback(null, address.address, address.family);
    };
    const agent = url.protocol === 'https:' ? new HttpsAgent({ lookup: pinnedLookup as any }) : new HttpAgent({ lookup: pinnedLookup as any });
    const controller = new AbortController();
    const abort = () => controller.abort();
    const dispose = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      controller.abort();
      agent.destroy();
    };
    const timer = setTimeout(abort, 15000);
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetch(url.href, {
        headers: { 'User-Agent': WEB_LIVE_UA, ...options.headers },
        redirect: 'manual', agent, signal: controller.signal as any,
        size: 2 * 1024 * 1024,
      }) as MediaResponse;
      clearTimeout(timer);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        response.body?.destroy();
        dispose();
        if (!location) throw new Error('上游跳转地址无效');
        target = new URL(location, url).href;
        continue;
      }
      const release = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        agent.destroy();
      };
      response.body?.once('end', release);
      response.body?.once('close', release);
      response.body?.once('error', release);
      return { response, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  }
  throw new Error('直播地址跳转次数过多');
}

interface MediaTicket { u: string; p: string; e: number; a: string; r: string }

function sign(value: string): Buffer {
  const secret = process.env.PASSWORD;
  if (!secret) throw new Error('站点尚未配置访问认证');
  return createHmac('sha256', secret).update(`apextv:web-live:v1\0${value}`).digest();
}

export function webLiveProxyUrl(url: string, platform: string, username: string, root = url, expires = Date.now() + 6 * 60 * 60 * 1000): string {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('上游直播地址格式无效');
  const payload: MediaTicket = { u: target.href, p: platform, a: username, r: new URL(root).origin, e: expires };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const ticket = `${encoded}.${sign(encoded).toString('base64url')}`;
  const filename = target.pathname.split('/').pop() || 'stream';
  return `/api/web-live/proxy/${encodeURIComponent(filename)}?ticket=${encodeURIComponent(ticket)}`;
}

export function readMediaTicket(value: string, username: string): MediaTicket {
  if (!value || value.length > 16000) throw new Error('直播链接无效，请重新打开直播间');
  const parts = value.split('.');
  if (parts.length !== 2) throw new Error('直播链接无效');
  const expected = sign(parts[0]);
  const actual = Buffer.from(parts[1], 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('直播链接校验失败');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as MediaTicket;
  if (typeof payload.u !== 'string' || typeof payload.p !== 'string' || typeof payload.r !== 'string' || payload.a !== username || !Number.isFinite(payload.e) || payload.e < Date.now()) throw new Error('直播链接已失效，请重新打开直播间');
  return payload;
}

export function platformReferer(platform: string): string {
  return ({ huya: 'https://www.huya.com/', bilibili: 'https://live.bilibili.com/', douyin: 'https://live.douyin.com/', douyu: 'https://www.douyu.com/' } as Record<string, string>)[platform] || '';
}
