'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useSite } from './SiteProvider';

export default function BrandLogo() {
  const { siteName } = useSite();
  return (
    <Link href='/' prefetch={false} aria-label={`${siteName} 首页`} className='ptv-brand flex min-w-0 flex-1 items-center'>
      <Image src='/favicon.ico' alt='' width={32} height={32} unoptimized className='h-8 w-8 shrink-0 object-contain' />
      <span className='ptv-brand-sep' aria-hidden='true' />
      <span className='truncate text-lg font-bold tracking-tight'>{siteName}</span>
    </Link>
  );
}
