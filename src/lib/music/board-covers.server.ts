import 'server-only';

import type { MusicSource } from './types';

type NativeBoard = {
  id?: string | number;
  sourceid?: string;
  rankId?: string;
  coverImgUrl?: string;
  picUrl?: string;
  pic?: string;
  imageUrl?: string;
  child?: NativeBoard[];
  contents?: NativeBoard[];
};

export function normalizeBoardCover(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (url.startsWith('/api/music/proxy?url=')) return url;
  if (!/^https?:\/\//.test(url)) return '';
  try {
    const target = new URL(url);
    if (
      target.hostname === 'kwcdn.kuwo.cn' ||
      target.hostname.endsWith('.kwcdn.kuwo.cn')
    ) {
      target.protocol = 'http:';
      return '/api/music/proxy?url=' + encodeURIComponent(target.toString());
    }
    return url.replace(/^http:/, 'https:');
  } catch {
    return '';
  }
}

/** 只缓存公开榜单图片元数据，不缓存站点配置或账号数据。 */
export async function getNativeBoardCovers(
  source: MusicSource
): Promise<Map<string, string>> {
  const endpoints: Partial<Record<MusicSource, string>> = {
    wy: 'https://music.163.com/api/toplist',
    tx: 'https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=1928093487&inCharset=utf-8&outCharset=utf-8&notice=0&format=json&uin=0&needNewCode=1&platform=h5',
    kw: 'https://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2',
    mg: 'https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0',
  };
  const url = endpoints[source];
  if (!url) return new Map();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 3600 },
      ...(source === 'mg'
        ? {
            headers: {
              Referer: 'https://app.c.nf.migu.cn/',
              channel: '0146921',
            },
          }
        : {}),
    });
    if (!response.ok) return new Map();
    const payload = await response.json();
    const covers = new Map<string, string>();
    const add = (id: unknown, cover: unknown) => {
      const normalized = normalizeBoardCover(cover);
      if (
        (typeof id === 'string' || typeof id === 'number') &&
        String(id).trim() &&
        normalized
      )
        covers.set(String(id), normalized);
    };
    if (source === 'wy' || source === 'tx') {
      const list = source === 'wy' ? payload.list : payload.data?.topList;
      if (Array.isArray(list))
        list.forEach((item: NativeBoard) =>
          add(item.id, item.coverImgUrl || item.picUrl)
        );
    } else {
      const visit = (items: NativeBoard[], depth = 0) => {
        if (depth > 8) return;
        for (const item of items.slice(0, 1000)) {
          if (!item || typeof item !== 'object') continue;
          if (source === 'kw') add(item.sourceid, item.pic);
          else add(item.rankId, item.imageUrl);
          const children = source === 'kw' ? item.child : item.contents;
          if (Array.isArray(children)) visit(children, depth + 1);
        }
      };
      visit(
        source === 'kw'
          ? [payload]
          : Array.isArray(payload.data?.contents)
          ? payload.data.contents
          : []
      );
    }
    return covers;
  } catch {
    return new Map();
  }
}
