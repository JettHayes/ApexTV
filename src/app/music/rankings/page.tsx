'use client';

import { ListMusic } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { musicSources, normalizeSource } from '@/lib/music/shared';
import type { Playlist } from '@/lib/music/types';

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

  useEffect(() => {
    const source = normalizeSource(searchParams.get('source'));
    const controller = new AbortController();
    let active = true;
    setCurrentSource(source);
    setLoading(true);
    fetch(`/api/music/v2/discovery/boards?source=${source}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('榜单请求失败');
        return res.json();
      })
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
      .catch(() => { if (active) setPlaylists([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      controller.abort();
    };
  }, [searchParams]);

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
      ) : playlists.length > 0 ? (
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
