'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useSite } from './SiteProvider';

export default function BrandLogo({ detailed = false }: { detailed?: boolean }) {
  const { siteName } = useSite();
  return (
    <Link href='/' prefetch={false} aria-label={`${siteName} 首页`} className='ptv-brand flex min-w-0 flex-1 items-center gap-3'>
      <Image src='/logo.svg' alt='' width={32} height={32} unoptimized className='h-8 w-8 shrink-0 object-contain' />
      <span className='ptv-brand-copy'>
        <span className='ptv-brand-name'>{siteName}</span>
        {detailed && <span className='ptv-brand-caption'>影音 · 直播 · 音乐</span>}
      </span>
    </Link>
  );
}
