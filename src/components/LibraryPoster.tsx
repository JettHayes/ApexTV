'use client';
import { Film } from 'lucide-react';
import { useEffect, useState } from 'react';
import { processImageUrl } from '@/lib/utils';

export default function LibraryPoster({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className='my-poster-image'>
      {src && !failed ? (
        <img
          src={processImageUrl(src)}
          alt={title}
          loading='lazy'
          decoding='async'
          onError={() => setFailed(true)}
        />
      ) : (
        <span className='my-poster-fallback'>
          <Film size={28} aria-hidden='true' />
          <span>{title}</span>
        </span>
      )}
    </span>
  );
}
