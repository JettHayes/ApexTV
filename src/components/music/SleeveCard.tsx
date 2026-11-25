'use client';

import { Disc3, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { subscribeRankingCover } from '@/lib/music/ranking-covers.client';
import type { MusicSource } from '@/lib/music/types';

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
      className='f1-album-card f1-ranking-card'
      aria-label={`打开${name}榜单`}
    >
      <span className={cn('f1-album-art', src && 'f1-album-art--loaded')}>
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
              <span className='f1-album-shade' aria-hidden />
            </>
          )}
          {!src && <span className='f1-album-fallback' aria-hidden><Disc3 strokeWidth={.8} /></span>}
          <span className='f1-album-rank'>{rankLabel}</span>
          {top && <span className='f1-album-source'>{top}</span>}
          <span className='f1-album-play' aria-hidden><Play size={22} fill='currentColor' /></span>
      </span>
      <span className='f1-album-caption'><span className='f1-album-title'>{name}</span>{meta && <span className='f1-album-meta'>{meta}</span>}</span>
    </button>
  );
}
