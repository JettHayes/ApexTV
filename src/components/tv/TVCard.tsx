'use client';

import { Play, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { processImageUrl } from '@/lib/utils';

import { TVItem } from './types';

export default function TVCard({ item }: { item: TVItem }) {
  const router = useRouter();
  const poster = item.poster ? processImageUrl(item.poster) : '';
  const playUrl = item.href || `/tv/detail?title=${encodeURIComponent(item.title)}${
    item.year ? `&year=${encodeURIComponent(item.year)}` : ''
  }${item.type ? `&stype=${item.type}` : ''}`;

  return (
    <button
      type='button'
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
        <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3'>
          <div className='inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-sm text-amber-300 backdrop-blur'>
            <Star className='h-4 w-4 fill-current' />
            {item.rate || '推荐'}
          </div>
        </div>
      </div>
      <h3 className='f1-tv-card-title mt-3 line-clamp-1 font-bold'>{item.title}</h3>
      <p className='f1-tv-card-meta mt-1'>{item.year || '即刻播放'}</p>
    </button>
  );
}
