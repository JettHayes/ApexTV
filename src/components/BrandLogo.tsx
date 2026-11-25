'use client';

import Link from 'next/link';

import { useSite } from './SiteProvider';

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  const { siteName } = useSite();
  return (
    <Link href='/' prefetch={false} aria-label={`${siteName} 首页`} className='ptv-brand flex min-w-0 flex-1 items-center gap-3'>
      <span className='ptv-brand-mark' aria-hidden='true'>
        <img src='/logo.svg' alt='' width={56} height={56} decoding='async' />
      </span>
      {!compact && <span className='ptv-brand-name'>{siteName}</span>}
    </Link>
  );
}
