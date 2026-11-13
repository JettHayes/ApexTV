'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LiveTabs({ active }: { active: 'live' | 'web-live' }) {
  const [enabled, setEnabled] = useState({ live: false, webLive: false });

  useEffect(() => {
    const config = window.RUNTIME_CONFIG || {};
    setEnabled({ live: !!config.LIVE_ENABLED, webLive: !!config.WEB_LIVE_ENABLED });
  }, []);

  if (!enabled.live && !enabled.webLive) return null;
  return (
    <nav className='ptv-live-tabs' aria-label='直播类型'>
      {enabled.live && <Link href='/live' aria-current={active === 'live' ? 'page' : undefined}>电视直播</Link>}
      {enabled.webLive && <Link href='/web-live' aria-current={active === 'web-live' ? 'page' : undefined}>网络直播</Link>}
    </nav>
  );
}
