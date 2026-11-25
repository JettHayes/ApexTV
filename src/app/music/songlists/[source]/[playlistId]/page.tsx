'use client';

import { Music2, Play } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isRequestCancelled,reportAppError, requestJson } from '@/lib/app-error';
import { playMusicList } from '@/lib/music/actions';
import { mapSong, musicSources, normalizeSource } from '@/lib/music/shared';
import type { Song } from '@/lib/music/types';

import ErrorNotice from '@/components/ErrorNotice';
import MusicEmpty, { MusicRowListSkeleton } from '@/components/music/MusicEmpty';
import MusicPage from '@/components/music/MusicPage';
import SongList from '@/components/music/SongList';
import { MUSIC_BUTTON, MUSIC_COUNT } from '@/components/music/tokens';

export default function MusicSongListDetailPage() {
  const params = useParams<{ source: string; playlistId: string }>();
  const searchParams = useSearchParams();
  const source = normalizeSource(params.source);
  const playlistId = decodeURIComponent(params.playlistId);
  const title = searchParams.get('name') || '歌单详情';
  const [songs, setSongs] = useState<Song[]>([]);
  // 初值 true：进页就拉曲目，给 false 会先闪一帧"这个歌单是空的"再跳成骨架。
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    requestJson<any>(`/api/music/v2/discovery/songlist-detail?source=${source}&id=${encodeURIComponent(playlistId)}`)
      .then((data) => {
        if (data.success) setSongs((data.data?.list || []).map(mapSong));
        else setSongs([]);
      })
      .catch((err) => { if (!isRequestCancelled(err)) { reportAppError(err, '获取歌单曲目'); setError(err); } })
      .finally(() => setLoading(false));
  }, [source, playlistId, retry]);

  const sourceLabel = musicSources.find((item) => item.key === source)?.label || source;

  return (
    <MusicPage
      title={title}
      subtitle={`歌单 · ${sourceLabel}`}

    >
      <div className='f1-music-detail-hero'>
        <div className='f1-music-detail-cover'>
          {songs[0]?.pic ? <img src={songs[0].pic} alt='' /> : <Music2 aria-hidden='true' />}
        </div>
        <div className='f1-music-detail-copy'>
          <span className='f1-music-detail-kicker'>{sourceLabel}</span>
          <h2>{title}</h2>
          <div className='f1-music-detail-actions'>
          <span className={MUSIC_COUNT}>{songs.length} 首</span>
          <button
            type='button'
            onClick={() => playMusicList(songs, title)}
            disabled={songs.length === 0}
            className={MUSIC_BUTTON}
          >
            <Play className='h-3.5 w-3.5' strokeWidth={2.2} />
            播放全部
          </button>
        </div>
        </div>
      </div>
      <div className='f1-music-detail-tracks'>
        <h2>曲目列表</h2>
      {loading ? (
        <MusicRowListSkeleton count={10} />
      ) : error ? (
        <ErrorNotice error={error} context='获取歌单曲目' onRetry={() => setRetry((value) => value + 1)} />
      ) : songs.length > 0 ? (
        <SongList songs={songs} />
      ) : (
        <MusicEmpty
          title='这个歌单是空的'
          hint='当前音源无法获取此歌单的曲目，换一个歌单试试。'
        />
      )}
      </div>
    </MusicPage>
  );
}
