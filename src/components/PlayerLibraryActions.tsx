'use client';

import { formatAppError } from '@/lib/app-error';

import dynamic from 'next/dynamic';
import { Bookmark, Check, FolderPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { libraryKey } from '@/lib/personal-library';
import type { LibraryVideo } from '@/lib/personal-library';
import {
  loadPersonalLibrary,
  organizeVideo,
  PERSONAL_LIBRARY_UPDATED,
  personalLibrarySnapshot,
} from '@/lib/personal-library.client';
import './PersonalLibrary.css';
const OrganizeVideoDialog = dynamic(() => import('./OrganizeVideoDialog'), {
  ssr: false,
});

export default function PlayerLibraryActions({
  video,
}: {
  video: LibraryVideo;
}) {
  const [planned, setPlanned] = useState(false),
    [busy, setBusy] = useState(false),
    [showLists, setShowLists] = useState(false);
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active)
        setPlanned(
          personalLibrarySnapshot().entries[libraryKey(video)]?.status ===
            'later'
        );
    };
    setPlanned(false);
    setMessage('');
    setError('');
    window.addEventListener(PERSONAL_LIBRARY_UPDATED, update);
    loadPersonalLibrary()
      .then(update)
      .catch(() => {
        if (active) setError('观看计划暂未读取成功，可点击按钮重试');
      });
    return () => {
      active = false;
      window.removeEventListener(PERSONAL_LIBRARY_UPDATED, update);
    };
  }, [video.source, video.id]);
  async function toggleLater() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const data = await loadPersonalLibrary();
      const wasPlanned = data.entries[libraryKey(video)]?.status === 'later';
      await organizeVideo(video, { status: wasPlanned ? '' : 'later' });
      setPlanned(!wasPlanned);
      setMessage(wasPlanned ? '已移出稍后观看' : '已加入稍后观看');
    } catch (error) {
      setError(formatAppError(error, "影片整理"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className='my-play-actions' aria-label='影片收藏与观看计划'>
      <span className='my-play-actions-label'>观看计划</span>
      <button
        type='button'
        className={'my-button' + (planned ? ' my-planned' : '')}
        aria-pressed={planned}
        disabled={busy}
        onClick={toggleLater}
        title={planned ? '点击移出稍后观看' : '加入稍后观看'}
      >
        {planned ? <Check size={16} /> : <Bookmark size={16} />}
        <span>{busy ? '正在保存…' : planned ? '已加入稍后' : '稍后观看'}</span>
      </button>
      <button
        type='button'
        className='my-button'
        disabled={busy}
        onClick={() => setShowLists(true)}
      >
        <FolderPlus size={16} />
        <span>加入片单</span>
      </button>
      {message && (
        <span className='my-play-actions-feedback' role='status'>
          {message}
        </span>
      )}
      {error && (
        <span className='my-play-actions-error' role='alert'>
          {error}
        </span>
      )}
      {showLists && (
        <OrganizeVideoDialog
          video={video}
          mode='lists'
          onClose={() => setShowLists(false)}
        />
      )}
    </div>
  );
}
