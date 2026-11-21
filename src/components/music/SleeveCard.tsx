'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { subscribeRankingCover } from '@/lib/music/ranking-covers.client';
import type { MusicSource } from '@/lib/music/types';

import {
  MUSIC_FACE,
  MUSIC_FACE_BOTTOM,
  MUSIC_FACE_CAT,
  MUSIC_FACE_META,
  MUSIC_FACE_NAME,
  MUSIC_FACE_TOP,
  MUSIC_SLEEVE,
  MUSIC_SLEEVE_DISC,
  MUSIC_SLEEVE_DISC_LABEL,
} from './tokens';

/** 榜单有封面时展示原图，缺图或加载失败时使用编号唱片套。 */
export default function SleeveCard({
  rank,
  name,
  cover,
  source,
  boardId,
  meta,
  top,
  onOpen,
}: {
  rank: number;
  name: string;
  cover?: string;
  source?: MusicSource;
  boardId?: string;
  /** 套面下沿那行小字（更新频率这类）。 */
  meta?: string;
  /** 套面左上角那行小字（"侧 A · 网易云"）。 */
  top?: string;
  onOpen: () => void;
}) {
  const rankLabel = String(rank).padStart(2, '0');
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const rootRef = useRef<HTMLButtonElement>(null);
  const [artwork, setArtwork] = useState({ key: '', cover: '' });
  const artworkKey = source + ':' + boardId;
  const fallback = artwork.key === artworkKey ? artwork.cover : '';
  const src =
    cover && cover !== failedCover
      ? cover
      : fallback !== failedCover
      ? fallback
      : '';

  useEffect(() => {
    if (
      !source ||
      !boardId ||
      (cover && cover !== failedCover) ||
      !rootRef.current
    )
      return;
    let unsubscribe: (() => void) | undefined;
    const load = () => {
      if (!unsubscribe)
        unsubscribe = subscribeRankingCover(source, boardId, (value) =>
          setArtwork({ key: source + ':' + boardId, cover: value })
        );
    };
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return () => unsubscribe?.();
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) load();
        else {
          unsubscribe?.();
          unsubscribe = undefined;
        }
      },
      { rootMargin: '80px' }
    );
    observer.observe(rootRef.current);
    return () => {
      observer.disconnect();
      unsubscribe?.();
    };
  }, [source, boardId, cover, failedCover]);

  return (
    <button
      ref={rootRef}
      type='button'
      onClick={onOpen}
      className={MUSIC_SLEEVE}
    >
      <span className='relative block aspect-square w-full'>
        <span aria-hidden className={MUSIC_SLEEVE_DISC}>
          <span className={MUSIC_SLEEVE_DISC_LABEL} />
        </span>

        <span className={cn(MUSIC_FACE, src && 'apex-sleeve-art')}>
          {src && (
            <>
              <img
                src={src}
                alt=''
                loading='lazy'
                decoding='async'
                referrerPolicy='no-referrer'
                onError={() => setFailedCover(src)}
                className='absolute inset-0 h-full w-full object-cover'
              />
              <span
                className='apex-sleeve-shade absolute inset-0'
                aria-hidden
              />
            </>
          )}
          {top ? <span className={MUSIC_FACE_TOP}>{top}</span> : null}
          {/* 名次就是这张套面的编号：不用 aria-hidden，它本来就是要读的内容。 */}
          <span className={cn(MUSIC_FACE_CAT, src && 'apex-sleeve-rank')}>
            {rankLabel}
          </span>
          <span className={MUSIC_FACE_BOTTOM}>
            <span className={MUSIC_FACE_NAME}>{name}</span>
            {meta ? <span className={MUSIC_FACE_META}>{meta}</span> : null}
          </span>
        </span>
      </span>
    </button>
  );
}
