'use client';

import {
  Film,
  Heart,
  Home,
  MonitorPlay,
  Radio,
  Search,
  Sparkles,
  Tv,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

import TVVirtualRemote from './TVVirtualRemote';
import BrandLogo from '../BrandLogo';
import { ThemeToggle } from '../ThemeToggle';

const navItems = [
  { label: '搜索', href: '/tv/search', icon: Search },
  { label: '主页', href: '/tv', icon: Home },
  { label: '电影', href: '/tv/movie', icon: Film },
  { label: '剧集', href: '/tv/series', icon: Tv },
  { label: '动漫', href: '/tv/anime', icon: Sparkles },
  { label: '综艺', href: '/tv/variety', icon: MonitorPlay },
  { label: '直播', href: '/tv/live', icon: Radio },
  { label: '私人影库', href: '/tv/private', icon: Heart },
  { label: '我的', href: '/tv/me', icon: User },
];

export default function TVLayout({
  children,
  showNav = true,
}: {
  children: ReactNode;
  showNav?: boolean;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!showNav || pathname !== '/tv') return;

    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) return;

      document
        .querySelector<HTMLElement>('[data-tv-home-nav="true"]')
        ?.focus({ preventScroll: true });
    });
  }, [pathname, showNav]);

  return (
    <main className='ptv-tv f1-tv-shell min-h-screen overflow-x-hidden'>
      <div className='f1-tv-ambient fixed inset-0 pointer-events-none' />
      {showNav && (
        <header className='f1-tv-header fixed inset-x-0 top-0 z-40'>
          <div className='f1-tv-brand'><BrandLogo /></div>
          <nav aria-label='电视主导航' className='f1-tv-navigation flex items-center gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none]'>
            {navItems.map((item) => {
              const active =
                item.href === '/tv'
                  ? pathname === '/tv'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tv-home-nav={item.href === '/tv' ? 'true' : undefined}
                  data-selected={active}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 text-xl font-semibold outline-none transition duration-200 tv-focusable ${
                    active
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white focus:bg-white/12'
                  }`}
                >
                  <Icon className='h-6 w-6' />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <ThemeToggle className='tv-focusable f1-tv-theme' />
        </header>
      )}
      <div className={`f1-tv-content relative z-10 ${showNav ? 'f1-tv-content--with-nav' : ''}`}>{children}</div>
      <TVVirtualRemote />
    </main>
  );
}
