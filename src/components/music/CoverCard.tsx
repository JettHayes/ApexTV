'use client';

import { ImageOff } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

import {
  MUSIC_ART_BROKEN,
  MUSIC_ART_BROKEN_LABEL,
  MUSIC_COVER,
  MUSIC_COVER_BODY,
  MUSIC_COVER_FRAME,
  MUSIC_COVER_META,
  MUSIC_COVER_NAME,
} from './tokens';

/** 歌单与专辑使用接口封面，缺图与加载失败分别给出提示。 */
export default function CoverCard({
  name,
  cover,
  meta,
  sub,
  onOpen,
}: {
  name: string;
  cover?: string;
  /** 右下角的计数（"120 首"）。 */
  meta?: React.ReactNode;
  /** 左下角那行（作者）。 */
  sub?: React.ReactNode;
  onOpen: () => void;
}) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const src = cover && cover !== failedCover ? cover : '';

  return (
    <button type='button' onClick={onOpen} className={MUSIC_COVER}>
      <span className={MUSIC_COVER_FRAME}>
        {src ? (
          <img
            src={src}
            alt=''
            loading='lazy'
            referrerPolicy='no-referrer'
            onError={() => setFailedCover(src)}
            className='h-full w-full object-cover'
          />
        ) : (
          <span className={MUSIC_ART_BROKEN}>
            <ImageOff className='h-6 w-6' strokeWidth={1.4} />
            <span className={MUSIC_ART_BROKEN_LABEL}>
              {cover ? '封面加载失败' : '暂无封面'}
            </span>
          </span>
        )}
      </span>
      <span className={cn(MUSIC_COVER_BODY, 'block')}>
        <span className={cn(MUSIC_COVER_NAME, 'block')}>{name}</span>
        {sub || meta ? (
          <span className={MUSIC_COVER_META}>
            <span className='truncate'>{sub}</span>
            <span className='shrink-0'>{meta}</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}
