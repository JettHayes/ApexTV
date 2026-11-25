'use client';

import { formatAppError, readJsonResponse, reportAppError } from '@/lib/app-error';


import { Folder, HardDrive, Loader2, Lock, PlayCircle, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { base58Encode } from '@/lib/utils';

import TVLayout from '@/components/tv/TVLayout';
import { getAllPlayRecords, subscribeToDataUpdates, type PlayRecord } from '@/lib/db.client';
import TVCard from '@/components/tv/TVCard';
import { TVItem } from '@/components/tv/types';

type SourceType = 'openlist' | 'emby' | 'xiaoya';
type Video = { id: string; title: string; poster?: string; year?: string; rating?: number; voteAverage?: number };
type EmbySource = { key: string; name: string };
type XiaoyaItem = { name: string; path: string };

export default function TVPrivatePage() {
  const router = useRouter();
  const runtimeConfig = useMemo(() => (typeof window !== 'undefined' ? (window as any).RUNTIME_CONFIG || {} : {}), []);
  const enabledSources: SourceType[] = useMemo(() => [
    runtimeConfig.OPENLIST_ENABLED ? 'openlist' : null,
    runtimeConfig.EMBY_ENABLED ? 'emby' : null,
    runtimeConfig.XIAOYA_ENABLED ? 'xiaoya' : null,
  ].filter(Boolean) as SourceType[], [runtimeConfig]);

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [source, setSource] = useState<SourceType>('openlist');
  const [embyKey, setEmbyKey] = useState('');
  const [embySources, setEmbySources] = useState<EmbySource[]>([]);
  const [videos, setVideos] = useState<TVItem[]>([]);
  const [folders, setFolders] = useState<XiaoyaItem[]>([]);
  const [files, setFiles] = useState<XiaoyaItem[]>([]);
  const [xiaoyaPath, setXiaoyaPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playRecords, setPlayRecords] = useState<Record<string, PlayRecord>>({});

  useEffect(() => {
    const ok = Boolean(getAuthInfoFromBrowserCookie());
    setAuthed(ok);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !authed) router.replace('/tv/login?redirect=/tv/private');
  }, [ready, authed, router]);

  useEffect(() => {
    if (enabledSources.length > 0 && !enabledSources.includes(source)) {
      setSource(enabledSources[0]);
    }
  }, [enabledSources, source]);

  useEffect(() => {
    if (source !== 'emby') return;
    fetch('/api/emby/sources').then((r) => readJsonResponse<any>(r, "电视端")).then((data) => {
      const list = data.sources || [];
      setEmbySources(list);
      if (!embyKey && list[0]?.key) setEmbyKey(list[0].key);
    }).catch(() => undefined);
  }, [source, embyKey]);

  const load = useCallback(async () => {
    if (!authed || enabledSources.length === 0) return;
    if (source === 'emby' && !embyKey) return;
    setLoading(true);
    setError('');
    setVideos([]);
    setFolders([]);
    setFiles([]);
    try {
      const endpoint = source === 'openlist'
        ? '/api/openlist/list?page=1&pageSize=40'
        : source === 'xiaoya'
        ? `/api/xiaoya/browse?path=${encodeURIComponent(xiaoyaPath)}`
        : `/api/emby/list?page=1&pageSize=40&embyKey=${encodeURIComponent(embyKey)}&sortBy=DateCreated&sortOrder=Descending`;
      const res = await fetch(endpoint);
      if (!res.ok) await readJsonResponse(res, "电视端");
      const data = await readJsonResponse<any>(res, "电视端");
      if (data.error) throw new Error(data.error);
      if (source === 'xiaoya') {
        setFolders(data.folders || []);
        setFiles(data.files || []);
      } else {
        const list: Video[] = data.list || [];
        setVideos(list.map((item) => ({
          id: item.id,
          title: item.title,
          poster: item.poster,
          year: item.year,
          rate: item.rating || item.voteAverage ? String(item.rating || item.voteAverage) : '私人',
          href: `/tv/play?source=${encodeURIComponent(source === 'emby' && embySources.length > 1 ? `emby:${embyKey}` : source)}&id=${encodeURIComponent(item.id)}&title=${encodeURIComponent(item.title)}`,
        })));
      }
    } catch (err) {
      setError(formatAppError(reportAppError(err, "电视端"), "电视端"));
    } finally {
      setLoading(false);
    }
  }, [authed, enabledSources.length, source, embyKey, embySources.length, xiaoyaPath]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!authed) return;
    let active = true;
    getAllPlayRecords().then((records) => { if (active) setPlayRecords(records); }).catch(() => undefined);
    const unsubscribe = subscribeToDataUpdates('playRecordsUpdated', (records: Record<string, PlayRecord>) => setPlayRecords(records));
    return () => { active = false; unsubscribe(); };
  }, [authed]);

  const privateRecords = useMemo(() => Object.entries(playRecords)
    .filter(([key, record]) => {
      const separator = key.indexOf('+');
      if (separator <= 0 || !key.slice(separator + 1) || record.origin === 'live') return false;
      const recordSource = key.slice(0, separator);
      return (recordSource === 'openlist' && enabledSources.includes('openlist')) ||
        (recordSource === 'xiaoya' && enabledSources.includes('xiaoya')) ||
        ((recordSource === 'emby' || recordSource.startsWith('emby_')) && enabledSources.includes('emby'));
    })
    .sort((a, b) => b[1].save_time - a[1].save_time)
    .slice(0, 12), [playRecords, enabledSources]);

  const sourceLabel = { openlist: 'OpenList', emby: 'Emby', xiaoya: '小雅' };

  if (!ready || !authed) {
    return <TVLayout><section className='mx-auto max-w-5xl rounded-[42px] border border-white/10 bg-slate-950/70 p-12 text-center shadow-2xl shadow-black/60'><Lock className='mx-auto h-20 w-20 text-rose-500' /><h1 className='mt-6 text-6xl font-black'>需要扫码登录</h1><p className='mt-5 text-2xl text-slate-300'>正在跳转到电视扫码登录页...</p></section></TVLayout>;
  }

  return (
    <TVLayout>
      <section className='f1-tv-private-browser rounded-[42px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-black/60'>
        <div className='flex items-center justify-between gap-6'>
          <div className='flex items-center gap-4'><HardDrive className='h-14 w-14 text-rose-500' /><div><h1 className='text-6xl font-black'>私人影库</h1><p className='mt-2 text-2xl text-slate-300'>选择媒体源，浏览和播放你的私人收藏。</p></div></div>
          <div className='f1-tv-private-sources'>
            <span>媒体源</span>{enabledSources.map((item) => <button key={item} onClick={() => setSource(item)} data-selected={source === item} className={`cursor-pointer rounded-2xl px-6 py-4 text-2xl font-bold outline-none transition tv-focusable ${source === item ? 'bg-rose-600 text-white' : 'bg-white/8 text-slate-200 hover:bg-white/12'}`}>{sourceLabel[item]}</button>)}
          </div>
        </div>
        {source === 'emby' && embySources.length > 1 && <div className='mt-6 flex gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none]'>{embySources.map((item) => <button key={item.key} onClick={() => setEmbyKey(item.key)} className={`tv-focusable cursor-pointer rounded-2xl px-5 py-3 text-xl font-bold ${embyKey === item.key ? 'tv-focusable-light bg-white text-black' : 'bg-white/10 text-white'}`}><Server className='mr-2 inline h-5 w-5' />{item.name}</button>)}</div>}
      </section>

      {loading && <div className='mt-16 flex justify-center gap-4 text-2xl text-slate-300'><Loader2 className='h-8 w-8 animate-spin' />正在加载私人影库...</div>}
      {error && <div className='mt-8 rounded-3xl border border-red-500/40 bg-red-950/40 p-6 text-2xl text-red-100'>{error}</div>}
      {!loading && enabledSources.length === 0 && <div className='mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-2xl text-slate-300'>未启用私人影库源。</div>}

      {!loading && source !== 'xiaoya' && videos.length > 0 && <section className='f1-tv-private-posters mt-10 grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-6'>{videos.map((item) => <TVCard key={item.id} item={item} />)}</section>}

      {privateRecords.length > 0 && <section className='f1-tv-private-continue'>
        <h2>继续观看</h2>
        <div>{privateRecords.map(([key, record]) => {
          const separator = key.indexOf('+');
          const recordSource = key.slice(0, separator);
          const id = key.slice(separator + 1);
          const progress = record.total_time > 0 ? Math.min(100, Math.max(0, Math.round(record.play_time / record.total_time * 100))) : 0;
          const item: TVItem = {
            id: key, title: record.title, poster: record.cover,
            year: record.total_episodes > 1 ? `第 ${record.index} 集` : record.year,
            rate: record.total_time > 0 ? `${progress}%` : '继续',
            href: `/tv/play?source=${encodeURIComponent(recordSource)}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(record.title)}`,
          };
          return <div className='f1-tv-private-watch-card' key={key}>
            <TVCard item={item} />
            {record.total_time > 0 && <div className='f1-tv-private-progress' aria-label={`播放进度 ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
          </div>;
        })}</div>
      </section>}
      {!loading && source === 'xiaoya' && <section className='mt-10 space-y-8'>
        <div className='rounded-3xl bg-white/[0.04] p-5 text-xl text-slate-300'>当前位置：{xiaoyaPath}</div>
        {xiaoyaPath !== '/' && <button onClick={() => setXiaoyaPath('/' + xiaoyaPath.split('/').filter(Boolean).slice(0, -1).join('/'))} className='cursor-pointer rounded-2xl bg-white/10 px-6 py-4 text-2xl font-bold outline-none tv-focusable'>返回上级</button>}
        {folders.length > 0 && <div><h2 className='mb-5 text-4xl font-black'>文件夹</h2><div className='grid grid-cols-2 gap-4 md:grid-cols-4'>{folders.map((folder) => <button key={folder.path} onClick={() => setXiaoyaPath(folder.path)} className='flex min-h-24 cursor-pointer items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-left text-2xl font-bold outline-none tv-focusable'><Folder className='h-9 w-9 text-rose-400' />{folder.name}</button>)}</div></div>}
        {files.length > 0 && <div><h2 className='mb-5 text-4xl font-black'>视频文件</h2><div className='grid gap-4'>{files.map((file) => {
          const pathParts = xiaoyaPath.split('/').filter(Boolean);
          const folderName = pathParts[pathParts.length - 1] || '';
          const title = folderName.replace(/\s*\(\d{4}\)\s*\{tmdb-\d+\}$/i, '').trim() || file.name;
          const encodedDirPath = base58Encode(xiaoyaPath);
          return <button key={file.path} onClick={() => router.push(`/tv/play?source=xiaoya&id=${encodeURIComponent(encodedDirPath)}&fileName=${encodeURIComponent(file.name)}&title=${encodeURIComponent(title)}`)} className='flex cursor-pointer items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-left text-2xl font-bold outline-none tv-focusable'><PlayCircle className='h-9 w-9 text-rose-400' />{file.name}</button>;
        })}</div></div>}
      </section>}
    </TVLayout>
  );
}
