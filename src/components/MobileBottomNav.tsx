'use client';

import { Ellipsis, Home, Library, Search, TvMinimalPlay } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SPECIAL_SOURCE_PATH } from '@/lib/special-source.client';

import { useNavigationItems } from './NavigationItems';

const MobileBottomNav = ({ activePath }: { activePath?: string }) => {
  const pathname = usePathname();
  const { config } = useNavigationItems();
  if (pathname === '/watch-room/screen') return null;
  const path = pathname || activePath || '/';
  const items = [
    { icon: Home, label: '首页', href: '/', active: path === '/' },
    { icon: Search, label: '搜索', href: path.startsWith(SPECIAL_SOURCE_PATH) ? SPECIAL_SOURCE_PATH : '/search', active: path.startsWith('/search') || path.startsWith(SPECIAL_SOURCE_PATH) },
    ...(config.PRIVATE_LIBRARY_ENABLED ? [{ icon: Library, label: '私人影库', href: '/private-library', active: path.startsWith('/private-library') }] : []),
    ...(config.LIVE_ENABLED || config.WEB_LIVE_ENABLED ? [{ icon: TvMinimalPlay, label: '直播', href: config.LIVE_ENABLED ? '/live' : '/web-live', active: path.startsWith('/live') || path.startsWith('/web-live') }] : []),
    { icon: Ellipsis, label: '更多', href: '/more', active: path === '/more' || path.startsWith('/douban') || path.startsWith('/music') || path.startsWith('/manga') || path.startsWith('/books') || path.startsWith('/advanced-recommendation') || path.startsWith('/watch-room') },
  ];
  return (
    <nav aria-label='移动端导航' className='ptv-mobile-nav fixed inset-x-0 bottom-0 z-[600] border-t md:hidden' style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className='flex'>
        {items.map(({ icon: Icon, label, href, active }) => (
          <li key={href} className='min-w-0 flex-1'>
            <Link href={href} prefetch={false} aria-current={active ? 'page' : undefined} data-active={active}
              className='ptv-nav-link flex h-14 flex-col items-center justify-center gap-1 text-xs'>
              <Icon className='h-5 w-5' aria-hidden='true' /><span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
export default MobileBottomNav;
