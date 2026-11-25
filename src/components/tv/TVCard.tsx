'use client';

import { Play, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { processImageUrl } from '@/lib/utils';

import { TVItem } from './types';

export default function TVCard({ item, landscape = false }: { item: TVItem; landscape?: boolean }) {
  const router = useRouter();
  const poster = item.poster ? processImageUrl(item.poster) : '';
  const playUrl = item.href || `/tv/detail?title=${encodeURIComponent(item.title)}${
    item.year ? `&year=${encodeURIComponent(item.year)}` : ''
  }${item.type ? `&stype=${item.type}` : ''}`;

  return (
    <button
      type='button'
      data-landscape={landscape || undefined}
      onClick={() => router.push(playUrl)}
      className='f1-tv-card group shrink-0 cursor-pointer text-left outline-none transition duration-200 tv-focusable'
    >
      <div className='f1-tv-poster relative aspect-[2/3] overflow-hidden transition duration-200'>
        {poster ? (
          <img src={poster} alt={item.title} loading='lazy' decoding='async' className='h-full w-full object-cover' />
        ) : (
          <div className='flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-slate-500'>
            <Play className='h-14 w-14' />
          </div>
        )}
        {typeof item.progress === 'number' ? (
          <div className='f1-tv-card-resume'><Play aria-hidden='true' /><span>{item.progress}%</span>
            <div className='f1-tv-card-progress' role='progressbar' aria-label='观看进度' aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
              <span style={{ transform: 'scaleX(' + item.progress / 100 + ')' }} />
            </div>
          </div>
        ) : <div className='f1-tv-card-badge'>
          {item.rate && /^\d+(\.\d+)?$/.test(item.rate) ? <Star aria-hidden='true' /> : null}
          {item.rate || '推荐'}
        </div>}
      </div>
      <h3 className='f1-tv-card-title mt-3 line-clamp-1 font-bold'>{item.title}</h3>
      <p className='f1-tv-card-meta mt-1'>{item.subtitle || item.year || '即刻播放'}</p>
    </button>
  );
}
