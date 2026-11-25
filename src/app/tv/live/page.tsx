'use client';

import { formatAppError, readJsonResponse, reportAppError } from '@/lib/app-error';


import { AlertTriangle, Loader2, Play, Radio, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Favorite, getAllFavorites, getAllPlayRecords, PlayRecord } from '@/lib/db.client';
import { parseCustomTimeFormat } from '@/lib/time';

import TVLayout from '@/components/tv/TVLayout';
import TVNativeVideo from '@/components/tv/player/TVNativeVideo';
import { resolveLiveUrl, type LiveSource, type LiveChannel, type TVPlayerSourceType } from '@/lib/tv-live-source';

type EpgProgram = { start: string; end: string; title: string };

function parseEpgTime(value: string): Date {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})$/);
  if (!match) return parseCustomTimeFormat(value);
  const [, year, month, day, hour, minute, second, zone] = match;
  return parseCustomTimeFormat(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`);
}

function formatEpgTime(value: string): string {
  const date = parseEpgTime(value || '');
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : value;
}
type LastLiveChannel = { source: string; sourceName?: string; id: string; title: string; group?: string; logo?: string; updatedAt?: number };

const TV_LIVE_LAST_CHANNEL_KEY = 'tv_live_last_channel';

function getLogoUrl(logo?: string, source?: string) {
  if (!logo) return '';
  if (logo.startsWith('/api/proxy/logo')) return logo;
  const sourceParam = source ? `&source=${encodeURIComponent(source)}` : '';
  return `/api/proxy/logo?url=${encodeURIComponent(logo)}${sourceParam}`;
}

export default function TVLivePage() {
  const router = useRouter();
  const [sources, setSources] = useState<LiveSource[]>([]);
  const [source, setSource] = useState<string>('');
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('全部');
  const [query, setQuery] = useState('');
  const [focusedChannel, setFocusedChannel] = useState<LiveChannel | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: TVPlayerSourceType } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [epgPrograms, setEpgPrograms] = useState<EpgProgram[]>([]);
  const [epgLoading, setEpgLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(120);
  const [quickChannels, setQuickChannels] = useState<Array<{ source: string; id: string; title: string; cover?: string; type: '最近' | '收藏' }>>([]);
  const [lastChannel, setLastChannel] = useState<LastLiveChannel | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TV_LIVE_LAST_CHANNEL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<LastLiveChannel>;
        if (parsed.source && parsed.id && parsed.title) {
          setLastChannel({
            source: parsed.source,
            sourceName: parsed.sourceName || '',
            id: parsed.id,
            title: parsed.title,
            group: parsed.group || '',
            logo: parsed.logo || '',
            updatedAt: parsed.updatedAt,
          });
        }
      }
    } catch {
      setLastChannel(null);
    }

    fetch('/api/live/sources')
      .then(async (r) => {
        if (!r.ok) await readJsonResponse(r, "电视端");
        return readJsonResponse<any>(r, "电视端");
      })
      .then((data) => {
        const list = data.data || [];
        setSources(list);
        if (list[0]?.key) setSource(list[0].key);
      })
      .catch((err) => setError(formatAppError(reportAppError(err, "电视端"), "电视端")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      getAllPlayRecords().catch(() => ({} as Record<string, PlayRecord>)),
      getAllFavorites().catch(() => ({} as Record<string, Favorite>)),
    ]).then(([records, favorites]) => {
      const recents = Object.entries(records)
        .filter(([, record]) => record.origin === 'live')
        .sort((a, b) => (b[1].save_time || 0) - (a[1].save_time || 0))
        .slice(0, 8)
        .map(([key, record]) => {
          const plus = key.indexOf('+');
          return {
            source: key.slice(0, plus).replace(/^live_/, ''),
            id: key.slice(plus + 1).replace(/^live_/, ''),
            title: record.title,
            cover: record.cover,
            type: '最近' as const,
          };
        });
      const favs = Object.entries(favorites)
        .filter(([, favorite]) => favorite.origin === 'live')
        .sort((a, b) => (b[1].save_time || 0) - (a[1].save_time || 0))
        .slice(0, 8)
        .map(([key, favorite]) => {
          const plus = key.indexOf('+');
          return {
            source: key.slice(0, plus).replace(/^live_/, ''),
            id: key.slice(plus + 1).replace(/^live_/, ''),
            title: favorite.title,
            cover: favorite.cover,
            type: '收藏' as const,
          };
        });
      setQuickChannels([...favs, ...recents].slice(0, 12));
    });
  }, []);

  useEffect(() => {
    if (!source) return;
    setLoading(true);
    setError('');
    setSelectedGroup('全部');
    setFocusedChannel(null);
    setVisibleCount(120);
    const controller = new AbortController();
    fetch(`/api/live/channels?source=${encodeURIComponent(source)}`, { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) throw new Error('无权限访问电视直播，请先登录或检查权限');
        if (!r.ok) await readJsonResponse(r, "电视端");
        return readJsonResponse<any>(r, "电视端");
      })
      .then((data) => {
        const nextChannels: LiveChannel[] = data.data || [];
        setChannels(nextChannels);
        setFocusedChannel(nextChannels[0] || null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setChannels([]);
        setError(formatAppError(reportAppError(err, "电视端"), "电视端"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [source]);

  const groups = useMemo(() => ['全部', ...Array.from(new Set(channels.map((c) => c.group || '其他')))], [channels]);
  const filteredChannels = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return channels.filter((channel) => {
      const groupMatched = selectedGroup === '全部' || (channel.group || '其他') === selectedGroup;
      const queryMatched = !keyword || channel.name.toLowerCase().includes(keyword) || (channel.group || '').toLowerCase().includes(keyword);
      return groupMatched && queryMatched;
    });
  }, [channels, query, selectedGroup]);
  const visibleChannels = useMemo(() => filteredChannels.slice(0, visibleCount), [filteredChannels, visibleCount]);

  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    setEpgPrograms([]);
    setEpgLoading(false);
    const selectedSource = sources.find((item) => item.key === source);
    if (!focusedChannel || !selectedSource) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      if (focusedChannel.url) {
        resolveLiveUrl(focusedChannel.url, selectedSource, controller.signal)
          .then((result) => { if (active) setPreview(result); })
          .catch((err) => { if (active && !controller.signal.aborted) setPreviewError(formatAppError(reportAppError(err, "电视端"), "电视端")); });
      } else {
        setPreviewError('频道没有可用播放地址');
      }
      const tvgId = focusedChannel.tvgId || focusedChannel.name;
      if (tvgId) {
        setEpgLoading(true);
        fetch(`/api/live/epg?source=${encodeURIComponent(source)}&tvgId=${encodeURIComponent(tvgId)}`, { signal: controller.signal })
          .then((response) => response.ok ? readJsonResponse<any>(response, "电视端") : null)
          .then((data) => {
            if (!active) return;
            const programs: EpgProgram[] = Array.isArray(data?.data?.programs) ? data.data.programs : [];
            const timed = programs.map((program) => ({
              program,
              start: parseEpgTime(program.start || '').getTime(),
              end: parseEpgTime(program.end || '').getTime(),
            }));
            if (timed.some((item) => !Number.isFinite(item.start) || !Number.isFinite(item.end))) {
              setEpgPrograms(programs);
              return;
            }
            timed.sort((a, b) => a.start - b.start);
            const next = timed.findIndex((item) => item.end > Date.now());
            const start = next < 0 ? Math.max(0, timed.length - 12) : Math.max(0, next - 1);
            setEpgPrograms(timed.slice(start, start + 12).map((item) => item.program));
          })
          .catch(() => { if (active) setEpgPrograms([]); })
          .finally(() => { if (active) setEpgLoading(false); });
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [focusedChannel, source, sources]);


  return (
    <TVLayout>
      {lastChannel && (
        <section className='mb-8 rounded-[34px] border border-rose-400/30 bg-rose-950/30 p-7 shadow-2xl shadow-black/50'>
          <button
            onClick={() => router.push(`/tv/live/play?source=${encodeURIComponent(lastChannel.source)}&id=${encodeURIComponent(lastChannel.id)}`)}
            className='tv-focusable flex w-full cursor-pointer items-center justify-between gap-6 rounded-3xl bg-white/10 p-6 text-left outline-none transition hover:bg-white/14 focus:ring-4 focus:ring-rose-300'
          >
            <div className='flex min-w-0 items-center gap-5'>
              {lastChannel.logo ? <img src={getLogoUrl(lastChannel.logo, lastChannel.source)} alt='' className='h-20 w-20 rounded-2xl object-contain' /> : <Radio className='h-16 w-16 shrink-0 text-rose-400' />}
              <div className='min-w-0'>
                <div className='mb-2 flex items-center gap-3 text-2xl font-black text-rose-100'>
                  <Play className='h-7 w-7 fill-current' />
                  开始观看
                </div>
                <div className='line-clamp-1 text-4xl font-black text-white'>{lastChannel.title}</div>
                <div className='mt-2 text-xl text-slate-300'>{lastChannel.sourceName || lastChannel.source}{lastChannel.group ? ` · ${lastChannel.group}` : ''}</div>
              </div>
            </div>
            <div className='shrink-0 rounded-2xl bg-rose-600 px-7 py-4 text-2xl font-black text-white'>播放</div>
          </button>
        </section>
      )}

      <section className='f1-tv-live-browser rounded-[42px] border border-white/10 bg-slate-950/70 p-10 shadow-2xl shadow-black/60'>
        <div className='flex items-center gap-4'>
          <Radio className='h-14 w-14 text-rose-500' />
          <div>
            <h1 className='text-6xl font-black'>直播</h1>
            <p className='mt-2 text-2xl text-slate-300'>浏览频道与节目单，选择后进入全屏播放。</p>
          </div>
        </div>
        <div className='f1-tv-live-sources mt-8 flex gap-4 overflow-x-auto px-4 py-4 [scrollbar-width:none]'>
          {sources.map((item) => (
            <button key={item.key} onClick={() => setSource(item.key)} data-selected={source === item.key} className={`cursor-pointer rounded-2xl px-6 py-4 text-2xl font-bold outline-none transition tv-focusable ${source === item.key ? 'bg-rose-600 text-white' : 'bg-white/8 text-slate-200 hover:bg-white/12'}`}>{item.name}</button>
          ))}
        </div>
        <label className='f1-tv-live-search mt-5 flex h-20 items-center gap-4 rounded-3xl border border-white/10 bg-white/10 px-6 focus-within:border-rose-500'>
          <Search className='h-8 w-8 text-slate-300' />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(120); }}
            placeholder='搜索频道或分类'
            className='tv-focusable h-16 flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder:text-slate-500'
          />
        </label>
      </section>

      {quickChannels.length > 0 && (
        <section className='mt-8 rounded-[34px] border border-white/10 bg-white/[0.04] p-6'>
          <h2 className='mb-5 text-3xl font-black'>常用频道</h2>
          <div className='flex gap-4 overflow-x-auto px-2 py-2 [scrollbar-width:none]'>
            {quickChannels.map((item) => (
              <button key={`${item.type}-${item.source}-${item.id}`} onClick={() => router.push(`/tv/live/play?source=${encodeURIComponent(item.source)}&id=${encodeURIComponent(item.id)}`)} className='tv-focusable flex min-w-[220px] cursor-pointer items-center gap-3 rounded-3xl bg-white/10 p-4 text-left outline-none focus:ring-4 focus:ring-rose-300'>
                {item.cover ? <img src={item.cover} alt='' className='h-12 w-12 rounded-xl object-contain' /> : <Radio className='h-10 w-10 text-rose-400' />}
                <div><div className='line-clamp-1 text-xl font-black'>{item.title}</div><div className='text-base text-slate-400'>{item.type}</div></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {error ? (
        <section role='alert' className='mt-10 rounded-[34px] border border-red-500/40 bg-red-950/45 p-8 text-red-100'>
          <div className='flex items-center gap-4 text-3xl font-black'><AlertTriangle className='h-10 w-10' />{error}</div>
          <button onClick={() => window.location.reload()} className='tv-focusable mt-6 cursor-pointer rounded-2xl bg-rose-600 px-7 py-4 text-2xl font-black text-white outline-none focus:ring-4 focus:ring-rose-300'>重试</button>
        </section>
      ) : loading ? <div className='mt-16 flex justify-center gap-4 text-2xl text-slate-300'><Loader2 className='h-8 w-8 animate-spin' />正在加载频道...</div> : (
        <div className='f1-tv-live-columns'>
          <aside className='rounded-[32px] border border-white/10 bg-white/[0.04] p-4'>
            <div className='max-h-[70vh] space-y-2 overflow-y-auto pr-2'>
              {groups.map((group) => <button key={group} onClick={() => { setSelectedGroup(group); setVisibleCount(120); }} data-selected={selectedGroup === group} className={`tv-focusable w-full cursor-pointer rounded-2xl px-5 py-4 text-left text-2xl font-bold outline-none focus:ring-4 focus:ring-rose-300 ${selectedGroup === group ? 'bg-rose-600 text-white' : 'text-slate-200 hover:bg-white/10'}`}>{group}</button>)}
            </div>
          </aside>
          <section className='f1-tv-live-channel-list'>
            <div className='mb-4 text-2xl font-bold text-slate-300'>{selectedGroup} · {filteredChannels.length} 个频道</div>
            <div className='f1-tv-live-channel-rows'>
            {visibleChannels.map((channel, index) => (
              <button key={channel.id} onFocus={() => setFocusedChannel(channel)} onClick={() => router.push(`/tv/live/play?source=${encodeURIComponent(source)}&id=${encodeURIComponent(channel.id)}`)} className='tv-focusable flex min-h-28 cursor-pointer items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-left outline-none transition hover:bg-white/12 focus:ring-4 focus:ring-rose-300'>
                {channel.logo ? <img src={getLogoUrl(channel.logo, source)} alt='' className='h-14 w-14 rounded-xl object-contain' /> : <Radio className='h-12 w-12 text-rose-400' />}
                <div><div className='line-clamp-1 text-2xl font-black'>{channel.name}</div><div className='mt-1 text-lg text-slate-400'>#{index + 1} · {channel.group || '直播频道'}</div></div>
              </button>
            ))}
            </div>
            {visibleCount < filteredChannels.length && (
              <button onClick={() => setVisibleCount((v) => v + 120)} className='tv-focusable mx-auto mt-8 block cursor-pointer rounded-3xl bg-white/10 px-10 py-5 text-2xl font-black text-white outline-none focus:ring-4 focus:ring-rose-300'>
                加载更多频道
              </button>
            )}
          </section>
          <aside className='f1-tv-live-preview'>
            {focusedChannel ? <>
              <div className='f1-tv-live-preview-image'>
                {preview ? <TVNativeVideo key={preview.type + ':' + preview.url} url={preview.url} sourceType={preview.type} title={focusedChannel.name} live muted controls onError={() => setPreviewError('预览播放失败')} />
                  : focusedChannel.logo ? <img src={getLogoUrl(focusedChannel.logo, source)} alt='' /> : <Radio />}
              </div>
              <h2>{focusedChannel.name}</h2>
              <p>{previewError || focusedChannel.group || '直播频道'}</p>
              <section className='f1-tv-live-epg'><h3>节目单</h3>
                {epgLoading ? <p>正在加载节目单...</p> : epgPrograms.length ? <div>{epgPrograms.map((program, index) => <div key={program.start + '-' + index}><time>{formatEpgTime(program.start)} - {formatEpgTime(program.end)}</time><span>{program.title}</span></div>)}</div> : <p>暂无节目单</p>}
              </section>
              <button className='tv-focusable' onClick={() => router.push(`/tv/live/play?source=${encodeURIComponent(source)}&id=${encodeURIComponent(focusedChannel.id)}`)}><Play /> 播放频道</button>
            </> : <p>选择频道查看详情</p>}
          </aside>
        </div>
      )}
    </TVLayout>
  );
}
