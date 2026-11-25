'use client';

import { ArrowLeft, ImageOff, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { formatAppError,readJsonResponse, reportAppError, requestJson } from '@/lib/app-error';
import { cn } from '@/lib/cn';
import { playMusicList } from '@/lib/music/actions';
import { mapSong } from '@/lib/music/shared';

import ErrorNotice from '@/components/ErrorNotice';
import MusicEmpty, {
  MusicRowListSkeleton,
} from '@/components/music/MusicEmpty';
import MusicPage from '@/components/music/MusicPage';
import SongList from '@/components/music/SongList';
import {
  MUSIC_ART_BROKEN,
  MUSIC_BACK_BUTTON,
  MUSIC_BAR_TITLE,
  MUSIC_BUTTON,
  MUSIC_COUNT,
  MUSIC_DANGER_BUTTON,
  MUSIC_DRAWER_ITEM,
  MUSIC_DRAWER_ITEM_ACTIVE,
  MUSIC_DRAWER_ITEM_IDLE,
  MUSIC_DRAWER_LABEL,
  MUSIC_DRAWER_MARK,
  MUSIC_ICON_BUTTON_DANGER,
  MUSIC_LABEL,
  MUSIC_MUTED,
  MUSIC_PICK_DESC,
  MUSIC_PICK_FRAME,
} from '@/components/music/tokens';

/**
 * 左栏歌单名前面那张小缩略图。
 *
 * 单独拎出来只为一件事：图挂了要有兜底。原来直接把 <img> 丢进框里，既没有
 * onError，也没有空态——图 404 时框里就是浏览器自带的破图图标压在卡纸上。
 * 兜底和歌单卡的破图是同一种（MUSIC_ART_BROKEN），不是热榜套面那种版面。
 */
function PickThumb({ src }: { src?: string }) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const url = src && src !== failedCover ? src : '';

  return (
    <span className={MUSIC_PICK_FRAME}>
      {url ? (
        <img
          src={url}
          alt=''
          loading='lazy'
          referrerPolicy='no-referrer'
          onError={() => setFailedCover(url)}
          className='h-full w-full object-cover'
        />
      ) : (
        <span className={MUSIC_ART_BROKEN}>
          <ImageOff className='h-3.5 w-3.5' strokeWidth={1.6} />
        </span>
      )}
    </span>
  );
}

export default function MusicMyPlaylistsPage() {
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [selectedUserPlaylist, setSelectedUserPlaylist] = useState<any | null>(
    null
  );
  const [userPlaylistSongs, setUserPlaylistSongs] = useState<any[]>([]);
  // 歌单列表挂载即拉，初值给 true 才不会先闪一帧"还没有歌单"。
  // 下面的曲目列表是人点出来的，初值就留 false。
  const [loadingUserPlaylists, setLoadingUserPlaylists] = useState(true);
  const [playlistsError, setPlaylistsError] = useState<unknown>(null);
  const [songsError, setSongsError] = useState<unknown>(null);
  const [loadingUserPlaylistSongs, setLoadingUserPlaylistSongs] =
    useState(false);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(
    null
  );
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);

  const loadUserPlaylists = useCallback(() => {
    setLoadingUserPlaylists(true);
    setPlaylistsError(null);
    requestJson<any>('/api/music/v2/playlists', undefined, '获取我的歌单')
      .then((data) => setUserPlaylists(data.data?.playlists || []))
      .catch((error) => { reportAppError(error, '获取我的歌单'); setPlaylistsError(error); })
      .finally(() => setLoadingUserPlaylists(false));
  }, []);

  useEffect(() => {
    loadUserPlaylists();
  }, [loadUserPlaylists]);

  const normalizePlaylistSong = (song: any) =>
    mapSong({
      ...song,
      id: song.songId || song.id,
      platform: song.source || song.platform,
      pic: song.cover || song.pic,
      duration: song.durationSec || song.duration,
    });

  const loadUserPlaylistSongs = useCallback((playlistId: string) => {
    setLoadingUserPlaylistSongs(true);
    setSongsError(null);
    requestJson<any>(`/api/music/v2/playlists/${playlistId}/songs`, undefined, '获取歌单歌曲')
      .then((data) => setUserPlaylistSongs(data.data?.songs || []))
      .catch((error) => { reportAppError(error, '获取歌单歌曲'); setSongsError(error); })
      .finally(() => setLoadingUserPlaylistSongs(false));
  }, []);

  // 手机上"进入 / 返回"都是换屏，要把页面带回顶部，否则会落在上一屏滚到的位置。
  // 桌面是两栏并排、没有换屏，别把页面拽走——所以只在小屏做。
  const scrollToTopOnPhone = () => {
    if (window.matchMedia('(max-width: 767px)').matches)
      window.scrollTo({ top: 0 });
  };

  const selectPlaylist = (playlist: any) => {
    setSelectedUserPlaylist(playlist);
    loadUserPlaylistSongs(playlist.id);
    scrollToTopOnPhone();
  };

  const backToList = () => {
    setSelectedUserPlaylist(null);
    setUserPlaylistSongs([]);
    scrollToTopOnPhone();
  };

  const deleteUserPlaylist = async (playlistId: string) => {
    if (!window.confirm('确定要删除这个歌单吗？')) return;

    setDeletingPlaylistId(playlistId);
    try {
      const response = await fetch(`/api/music/v2/playlists/${playlistId}`, {
        method: 'DELETE',
      });
      await readJsonResponse(response, '删除歌单');

      if (selectedUserPlaylist?.id === playlistId) {
        setSelectedUserPlaylist(null);
        setUserPlaylistSongs([]);
      }
      loadUserPlaylists();
    } catch (error) {
      reportAppError(error, '删除歌单');
      window.alert(formatAppError(error, '删除歌单'));
    } finally {
      setDeletingPlaylistId(null);
    }
  };

  const removeSongFromUserPlaylist = async (song: any) => {
    if (!selectedUserPlaylist) return;
    if (!window.confirm(`确定要从歌单中移除 "${song.name}" 吗？`)) return;

    setRemovingSongId(song.id);
    try {
      const response = await fetch(
        `/api/music/v2/playlists/${
          selectedUserPlaylist.id
        }/songs?songId=${encodeURIComponent(song.id)}`,
        { method: 'DELETE' }
      );
      await readJsonResponse(response, '移除歌曲');

      loadUserPlaylistSongs(selectedUserPlaylist.id);
    } catch (error) {
      reportAppError(error, '移除歌曲');
      window.alert(formatAppError(error, '移除歌曲'));
    } finally {
      setRemovingSongId(null);
    }
  };

  // 这一页不看播放器状态：点行就是播它，所以行内不接 useNowPlaying，
  // 免得把"上次听的那首"错标成"这个歌单里的第一首"。
  const mappedSongs = userPlaylistSongs.map(normalizePlaylistSong);

  return (
    <MusicPage
      title='我的歌单'
      subtitle={
        userPlaylists.length > 0 ? `${userPlaylists.length} 个歌单` : undefined
      }
    >
      {/* 手机上不上下堆叠，两栏二选一：没选中就只有歌单列表，点进一个就整屏让给曲目，
          靠上面那颗返回键退回列表。md 起恢复两栏并排，两栏同时在，返回键收起。 */}
      {loadingUserPlaylists && userPlaylists.length === 0 ? (
        <MusicRowListSkeleton count={4} />
      ) : playlistsError ? (
        <ErrorNotice error={playlistsError} context='获取我的歌单' onRetry={loadUserPlaylists} />
      ) : userPlaylists.length === 0 ? (
        <MusicEmpty
          className='apex-music-empty'
          title='收好喜欢的歌，留给下一次播放'
          hint='搜索一首歌，点击歌曲旁的爱心即可创建歌单并加入。'
          action={
            <Link href='/music/search' className={MUSIC_BUTTON}>
              去找音乐
            </Link>
          }
        />
      ) : (
        <div className='apex-playlist-workspace f1-playlist-library grid grid-cols-1 gap-6 md:grid-cols-3'>
          <div
            className={cn(
              'f1-playlist-directory md:col-span-1',
              selectedUserPlaylist && 'hidden md:block'
            )}
          >
            <span className={cn(MUSIC_LABEL, 'mb-2 block')}>歌单</span>
            {loadingUserPlaylists ? (
              <MusicRowListSkeleton count={4} />
            ) : (
              <div className='flex flex-col gap-1'>
                {userPlaylists.map((playlist) => {
                  const active = selectedUserPlaylist?.id === playlist.id;
                  return (
                    <button
                      key={playlist.id}
                      type='button'
                      aria-pressed={active}
                      onClick={() => selectPlaylist(playlist)}
                      className={cn(
                        MUSIC_DRAWER_ITEM,
                        active
                          ? MUSIC_DRAWER_ITEM_ACTIVE
                          : MUSIC_DRAWER_ITEM_IDLE
                      )}
                    >
                      <PickThumb src={playlist.cover} />
                      <span className='min-w-0 flex-1'>
                        <span
                          className={cn(MUSIC_DRAWER_LABEL, 'block truncate')}
                        >
                          {playlist.name}
                        </span>
                        {playlist.description ? (
                          <span className={cn(MUSIC_PICK_DESC, 'block')}>
                            {playlist.description}
                          </span>
                        ) : typeof playlist.song_count === 'number' ? (
                          <span className={cn(MUSIC_PICK_DESC, 'block')}>
                            {playlist.song_count} 首
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <span aria-hidden className={MUSIC_DRAWER_MARK} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className={cn(
              'f1-playlist-tracks md:col-span-2',
              !selectedUserPlaylist && 'hidden md:block'
            )}
          >
            {selectedUserPlaylist ? (
              <>
                <button
                  type='button'
                  onClick={backToList}
                  className={cn(MUSIC_BACK_BUTTON, 'mb-3 md:hidden')}
                >
                  <ArrowLeft className='h-3.5 w-3.5' strokeWidth={2} />
                  全部歌单
                </button>
                {/* 这里不画下边框：曲目列表自己的上沿有一道实线，两条线一叠会像画歪了。 */}
                <div className='flex flex-wrap items-start justify-between gap-3 pb-1'>
                  <div className='min-w-0'>
                    <div
                      className={cn(
                        MUSIC_BAR_TITLE,
                        'text-[calc(20*var(--music-px))]'
                      )}
                    >
                      {selectedUserPlaylist.name}
                    </div>
                    {selectedUserPlaylist.description ? (
                      <p
                        className={cn(
                          MUSIC_MUTED,
                          'mt-1 font-music-body text-[calc(12*var(--music-px))]'
                        )}
                      >
                        {selectedUserPlaylist.description}
                      </p>
                    ) : null}
                  </div>
                  <div className='flex shrink-0 flex-wrap items-center gap-2'>
                    <span className={MUSIC_COUNT}>{mappedSongs.length} 首</span>
                    <button
                      type='button'
                      onClick={() =>
                        playMusicList(mappedSongs, selectedUserPlaylist.name)
                      }
                      disabled={mappedSongs.length === 0}
                      className={MUSIC_BUTTON}
                    >
                      <Play className='h-3.5 w-3.5' strokeWidth={2.2} />
                      播放全部
                    </button>
                    <button
                      type='button'
                      onClick={() =>
                        deleteUserPlaylist(selectedUserPlaylist.id)
                      }
                      disabled={deletingPlaylistId !== null}
                      className={MUSIC_DANGER_BUTTON}
                    >
                      <Trash2 className='h-3.5 w-3.5' strokeWidth={2} />
                      {deletingPlaylistId === selectedUserPlaylist.id
                        ? '删除中…'
                        : '删除歌单'}
                    </button>
                  </div>
                </div>

                {loadingUserPlaylistSongs ? (
                  <MusicRowListSkeleton count={6} />
                ) : songsError ? (
                  <ErrorNotice error={songsError} context='获取歌单歌曲' onRetry={() => loadUserPlaylistSongs(selectedUserPlaylist.id)} />
                ) : mappedSongs.length === 0 ? (
                  <MusicEmpty
                    className='mt-4'
                    title='这个歌单还是空的'
                    hint='在歌曲行上点那颗心，把歌加进来。'
                  />
                ) : (
                  <SongList
                    songs={mappedSongs}
                    extraActions={(song) => (
                      <button
                        type='button'
                        title='从歌单移除'
                        aria-label='从歌单移除'
                        disabled={removingSongId === song.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeSongFromUserPlaylist(song);
                        }}
                        className={MUSIC_ICON_BUTTON_DANGER}
                      >
                        <Trash2 className='h-3.5 w-3.5' strokeWidth={1.9} />
                      </button>
                    )}
                  />
                )}
              </>
            ) : (
              <MusicEmpty
                className='min-h-[280px]'
                title='还没有选中歌单'
                hint='从左边挑一个，曲目会显示在这里。'
              />
            )}
          </div>
        </div>
      )}
    </MusicPage>
  );
}
