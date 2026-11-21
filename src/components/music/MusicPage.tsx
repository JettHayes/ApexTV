'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import {
  MUSIC_BAR_SUB,
  MUSIC_BAR_TITLE,
  MUSIC_PAGE_BODY,
  MUSIC_TEXT,
} from './tokens';

const destinations = [
  { href: '/music/rankings', label: '排行榜' },
  { href: '/music/songlists', label: '推荐歌单' },
  { href: '/music/search', label: '搜索' },
  { href: '/music/my-playlists', label: '我的歌单' },
];

export default function MusicPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={cn(MUSIC_PAGE_BODY, MUSIC_TEXT)}>
      <header className='apex-music-toolbar'>
        <div className='apex-music-heading'>
          <h1 className={MUSIC_BAR_TITLE}>{title}</h1>
          {subtitle ? <p className={MUSIC_BAR_SUB}>{subtitle}</p> : null}
        </div>
        <nav className='apex-music-navigation' aria-label='音乐导航'>
          {destinations.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                pathname?.startsWith(item.href) ||
                (pathname === '/music' && item.href === '/music/rankings')
                  ? 'page'
                  : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {actions ? <div className='apex-music-actions'>{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
