import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { isTVModeEnabled } from '@/lib/tv-mode';

import TVRemoteReceiver from '@/components/tv/TVRemoteReceiver';

export const metadata = {
  title: 'TV - ApexTV',
};

export default function Layout({ children }: { children: ReactNode }) {
  if (!isTVModeEnabled()) {
    notFound();
  }

  return (
    <div className='f1-tv-root'>
      {children}
      <TVRemoteReceiver />
    </div>
  );
}
