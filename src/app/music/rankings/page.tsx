'use client';

import { ListMusic, Play } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isRequestCancelled,reportAppError, requestJson } from '@/lib/app-error';
import { musicSources, normalizeSource } from '@/lib/music/shared';
import type { Playlist } from '@/lib/music/types';

import ErrorNotice from '@/components/ErrorNotice';
import MusicEmpty, { MusicSleeveGridSkeleton } from '@/components/music/MusicEmpty';
import MusicPage from '@/components/music/MusicPage';
import MusicSwitch from '@/components/music/MusicSwitch';
import SleeveCard from '@/components/music/SleeveCard';
import { MUSIC_SLEEVE_GRID } from '@/components/music/tokens';

/** 榜单卡的键名方块用音源缩写，和音源切换共用一套标识。 */
const sourceOptions = musicSources.map((item) => ({
  key: item.key,
  label: item.label,
  monogram: item.monogram,
}));

export default function MusicRankingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSource, setCurrentSource] = useState(normalizeSource(searchParams.get('source')));
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  // 初值是 true：这页挂载即发请求，给 false 会先用"长度为 0"的判断渲染一帧空态
  // （"无法获取此榜单"），effect 跑起来才切成骨架。骨架才是真正的初始态。
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const source = normalizeSource(searchParams.get('source'));
    const controller = new AbortController();
    let active = true;
    setCurrentSource(source);
    setLoading(true);
    setError(null);
    requestJson<any>(`/api/music/v2/discovery/boards?source=${source}`, { signal: controller.signal }, '获取榜单')
      .then((data) => {
        if (!active) return;
        if (data.success) {
          setPlaylists((data.data?.list || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            cover: item.cover || item.pic || item.img,
            source: normalizeSource(item.source || data.data?.source || source),
            updateFrequency: item.updateFrequency || item.description || '',
          })));
        } else {
          setPlaylists([]);
        }
      })
      .catch((err) => { if (active && !isRequestCancelled(err)) { reportAppError(err, '获取榜单'); setError(err); } })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      controller.abort();
    };
  }, [searchParams, retry]);

  const currentSourceLabel =
    musicSources.find((item) => item.key === currentSource)?.label || '音源';

  return (
    <MusicPage
      title='热歌榜单'
      subtitle={`${currentSourceLabel} · 发现正在热播的声音`}
      actions={
        <MusicSwitch
          field='音源'
          value={currentSource}
          options={sourceOptions}
          onChange={(next) => router.push(`/music/rankings?source=${next}`)}
        />
      }
    >
      {loading ? (
        <MusicSleeveGridSkeleton count={10} />
      ) : error ? (
        <ErrorNotice error={error} context='获取榜单' onRetry={() => setRetry((value) => value + 1)} />
      ) : playlists.length > 0 ? (
        <>
          <section className='f1-music-ranking-feature'>
            {playlists[0].cover && <img src={playlists[0].cover} alt='' referrerPolicy='no-referrer' />}
            <div className='f1-music-ranking-feature-copy'>
              <span>{currentSourceLabel} · 榜单</span>
              <h2>{playlists[0].name}</h2>
              {playlists[0].updateFrequency && <p>{playlists[0].updateFrequency}</p>}
              <button type='button' onClick={() => router.push(
                `/music/rankings/${playlists[0].source || currentSource}/${encodeURIComponent(playlists[0].id)}?name=${encodeURIComponent(playlists[0].name)}`
              )}><Play size={15} fill='currentColor' />查看榜单</button>
            </div>
          </section>
          <section className='f1-music-ranking-quick'>
            <div className='f1-music-ranking-heading'><h2>热歌榜单</h2><Link href='/music/songlists'>推荐歌单 ›</Link></div>
            <div>{playlists.slice(0, 5).map((playlist, index) => (
              <button key={playlist.id} type='button' onClick={() => router.push(
                `/music/rankings/${playlist.source || currentSource}/${encodeURIComponent(playlist.id)}?name=${encodeURIComponent(playlist.name)}`
              )}><span>{String(index + 1).padStart(2, '0')}</span><strong>{playlist.name}</strong></button>
            ))}</div>
          </section>
          <section className='f1-music-ranking-all'>
          <h2>全部榜单</h2>
          <div className={`${MUSIC_SLEEVE_GRID} f1-album-grid`}>
          {playlists.map((playlist, index) => (
            <SleeveCard
              key={playlist.id}
              rank={index + 1}
              name={playlist.name}
              cover={playlist.cover}
              source={playlist.source || currentSource}
              boardId={playlist.id}
              top={
                musicSources.find((item) => item.key === playlist.source)?.label ||
                currentSourceLabel
              }
              meta={playlist.updateFrequency}
              onOpen={() =>
                router.push(
                  `/music/rankings/${playlist.source || currentSource}/${encodeURIComponent(playlist.id)}?name=${encodeURIComponent(playlist.name)}`
                )
              }
            />
          ))}
          </div>
          </section>
        </>
      ) : (
        <MusicEmpty
          icon={ListMusic}
          title='当前音源无法获取此榜单'
          hint='换一个音源试试，或者稍后再来——上游榜单接口有时会空一阵。'
        />
      )}
    </MusicPage>
  );
}
