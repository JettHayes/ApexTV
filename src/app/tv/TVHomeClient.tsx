'use client';

import ErrorNotice from '@/components/ErrorNotice';


import { readJsonResponse, reportAppError } from '@/lib/app-error';


import { Loader2, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { processImageUrl } from '@/lib/utils';

import {
  Favorite,
  getAllFavorites,
  getAllPlayRecords,
  PlayRecord,
} from '@/lib/db.client';

import TVLayout from '@/components/tv/TVLayout';
import TVRow from '@/components/tv/TVRow';
import { TVItem, TVSection } from '@/components/tv/types';

async function loadDouban(kind: 'movie' | 'tv', tag: string, type: TVItem['type']): Promise<TVItem[]> {
  const res = await fetch(`/api/douban?type=${kind}&tag=${encodeURIComponent(tag)}&pageSize=12`, { cache: 'no-store' });
  if (!res.ok) await readJsonResponse(res, "电视端");
  const data = await readJsonResponse<any>(res, "电视端");
  return (data.list || []).map((item: TVItem) => ({ ...item, type }));
}

function hrefFromKey(key: string, item: { title: string; year?: string; origin?: 'vod' | 'live' }) {
  const plus = key.indexOf('+');
  if (plus > 0) {
    const source = key.slice(0, plus);
    const id = key.slice(plus + 1);
    if (item.origin === 'live') {
      return `/tv/live/play?source=${encodeURIComponent(source.replace(/^live_/, ''))}&id=${encodeURIComponent(id.replace(/^live_/, ''))}`;
    }
    return `/tv/play?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(item.title)}`;
  }
  return `/tv/play?title=${encodeURIComponent(item.title)}${item.year ? `&year=${encodeURIComponent(item.year)}` : ''}`;
}

function recordToItem([key, record]: [string, PlayRecord]): TVItem {
  return {
    id: key,
    title: record.title,
    poster: record.cover,
    year: record.year || `${record.index + 1}/${record.total_episodes || 1}`,
    progress: record.total_time > 0 ? Math.min(100, Math.max(0, Math.round(record.play_time / record.total_time * 100))) : 0,
    subtitle: record.total_episodes > 1 ? '剧集 · 继续播放' : '继续播放',
    href: hrefFromKey(key, record),
  };
}

function favoriteToItem([key, favorite]: [string, Favorite]): TVItem {
  return {
    id: key,
    title: favorite.title,
    poster: favorite.cover,
    year: favorite.year,
    rate: '收藏',
    href: hrefFromKey(key, favorite),
  };
}

export default function TVHomeClient() {
  const [sections, setSections] = useState<TVSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      const loadSection = (kind: 'movie' | 'tv', tag: string, type: TVItem['type']) => loadDouban(kind, tag, type).catch((error) => {
        if (alive) setLoadError(error); reportAppError(error, '电视首页推荐'); return [] as TVItem[];
      });
      const [records, favorites, hotMovies, hotSeries, anime, variety] = await Promise.all([
        getAllPlayRecords().catch(() => ({})),
        getAllFavorites().catch(() => ({})),
        loadSection('movie', '热门', 'movie'),
        loadSection('tv', '热门', 'tv'),
        loadSection('tv', '动画', 'tv'),
        loadSection('tv', '综艺', 'tv'),
      ]);
      if (!alive) return;

      const playItems = Object.entries(records)
        .sort((a, b) => (b[1].save_time || 0) - (a[1].save_time || 0))
        .slice(0, 20)
        .map(recordToItem);
      const favoriteItems = Object.entries(favorites)
        .sort((a, b) => (b[1].save_time || 0) - (a[1].save_time || 0))
        .slice(0, 20)
        .map(favoriteToItem);

      const next: TVSection[] = [
        { title: '继续观看', subtitle: '最近 20 条播放记录', items: playItems, layout: 'continue' as const },
        { title: '我的收藏', subtitle: '最近收藏的内容', items: favoriteItems },
        { title: '热门电影', subtitle: '今晚就看这些高热影片', href: '/tv/movie', items: hotMovies },
        { title: '热门剧集', subtitle: '连续播放更适合电视', href: '/tv/series', items: hotSeries },
        { title: '动漫推荐', subtitle: '新番与经典动画', href: '/tv/anime', items: anime },
        { title: '综艺推荐', subtitle: '轻松下饭大屏看', href: '/tv/variety', items: variety },
      ].filter((section) => section.items.length > 0);

      setSections(next);
      setLoading(false);
    }
    load().catch((error) => { if (alive) setLoadError(error); reportAppError(error, '电视首页加载'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const empty = useMemo(() => !loading && sections.length === 0, [loading, sections.length]);
  const featured = useMemo(() => sections.find((section) => section.title === '热门电影')?.items[0] || sections.flatMap((section) => section.items).find((item) => item.poster), [sections]);
  const featuredHref = featured ? featured.href || `/tv/detail?title=${encodeURIComponent(featured.title)}${featured.year ? `&year=${encodeURIComponent(featured.year)}` : ''}${featured.type ? `&stype=${featured.type}` : ''}` : '';

  return (
    <TVLayout>
      {loadError != null && <ErrorNotice error={loadError} context='电视首页加载' onRetry={() => window.location.reload()} />}
      {loading ? (
        <div className='mt-16 flex items-center justify-center gap-4 text-2xl text-slate-300'>
          <Loader2 className='h-8 w-8 animate-spin' /> 正在加载电视首页...
        </div>
      ) : empty ? (
        <div className='rounded-[36px] border border-white/10 bg-white/[0.04] p-10 text-2xl text-slate-300'>暂无首页内容</div>
      ) : (
        <div className='f1-tv-home'>
          {featured ? (
            <section className='f1-tv-feature f1-tv-home-feature'>
              {featured.poster ? <img className='f1-tv-feature-backdrop' src={processImageUrl(featured.poster)} alt='' /> : null}
              <div className='f1-tv-feature-copy'>
                <span className='f1-tv-feature-kicker'>热门推荐</span>
                <h1>{featured.title}</h1>
                <div className='f1-tv-feature-meta'>{featured.year ? <span>{featured.year}</span> : null}{featured.rate ? <span>{featured.rate}</span> : null}</div>
                <Link href={featuredHref} className='f1-tv-feature-action tv-focusable'><Play size={22} fill='currentColor' /> {featured.href ? '播放' : '查看详情'}</Link>
              </div>
              {featured.poster ? <img className='f1-tv-feature-poster' src={processImageUrl(featured.poster)} alt='' /> : null}
            </section>
          ) : null}
          <div className='f1-tv-home-rows'>{sections.map((section) => <TVRow key={section.title} section={section} />)}</div>
        </div>
      )}
    </TVLayout>
  );
}
