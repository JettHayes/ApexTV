'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';

import { SPECIAL_SOURCE_PATH } from '@/lib/special-source.client';

import BrandLogo from './BrandLogo';
import SidebarResume from './SidebarResume';
import { navigationActive, useNavigationItems } from './NavigationItems';

interface SidebarContextType {
  isCollapsed: boolean;
}
const SidebarContext = createContext<SidebarContextType>({ isCollapsed: false });
export const useSidebar = () => useContext(SidebarContext);

declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
    RUNTIME_CONFIG?: { EnableComments?: boolean; RecommendationDataSource?: string; [key: string]: any };
  }
}

const Sidebar = ({ onToggle }: { onToggle?: (collapsed: boolean) => void; activePath?: string }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isUnderPath = pathname === SPECIAL_SOURCE_PATH || pathname.startsWith(SPECIAL_SOURCE_PATH + '/');
  const { primary, categories, personal, other } = useNavigationItems(isUnderPath ? SPECIAL_SOURCE_PATH : '/search');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const media = window.matchMedia('(min-width: 1200px)');
    const update = () => {
      const saved = localStorage.getItem('sidebarCollapsed');
      const explicit = saved === 'true' || saved === 'false';
      const collapsed = explicit ? saved === 'true' : !media.matches;
      setIsCollapsed(collapsed);
      window.__sidebarCollapsed = collapsed;
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    if (isCollapsed) document.documentElement.dataset.sidebarCollapsed = 'true';
    else delete document.documentElement.dataset.sidebarCollapsed;
  }, [isCollapsed]);

  const handleToggle = useCallback(() => {
    const next = !isCollapsed;
    setAnimate(true);
    setIsCollapsed(next);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
    window.__sidebarCollapsed = next;
    onToggle?.(next);
  }, [isCollapsed, onToggle]);



  if (pathname === '/watch-room/screen') return null;

  const renderItems = (items: typeof primary) => items.map(({ icon: Icon, label, href }) => {
    const active = navigationActive(pathname, searchParams.toString(), href);
    return (
      <Link key={href} href={href} prefetch={false} title={isCollapsed ? label : undefined}
        aria-label={label} aria-current={active ? 'page' : undefined} data-active={active}
        className='ptv-nav-link flex min-h-11 items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors'>
        <Icon className='h-5 w-5 shrink-0' aria-hidden='true' />
        <span className='ptv-nav-label truncate'>{label}</span>
      </Link>
    );
  });

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <div className='hidden md:flex'>
        <aside data-sidebar data-collapsed={isCollapsed} data-animate={animate} className='ptv-sidebar fixed left-0 top-0 z-40 h-dvh border-r'>
          <div className='flex h-full flex-col'>
            <div className='ptv-sidebar-brand'>
              <BrandLogo compact={isCollapsed} />
              <button type='button' onClick={handleToggle} aria-label={isCollapsed ? '展开导航' : '收起导航'} aria-expanded={!isCollapsed}
                className='ptv-sidebar-toggle flex shrink-0 items-center justify-center rounded-lg'>
                <Menu className='h-5 w-5' />
              </button>
            </div>
            <nav aria-label='主导航' className='flex-1 min-h-0 overflow-y-auto px-2 pb-4'>
              <div className='space-y-1'>{renderItems(primary)}</div>
              <div className='ptv-nav-group'>
                <div className='ptv-nav-group-title' aria-hidden={isCollapsed}>
                  <div><p className='px-4 pb-2 text-xs font-medium opacity-60'>影视分类</p></div>
                </div>
                <div className='space-y-1'>{renderItems(categories)}</div>
              </div>
              <div className='ptv-nav-group'>
                {!isCollapsed && <p className='px-4 pb-2 text-xs font-medium opacity-60'>我的</p>}
                <div className='space-y-1'>{renderItems(personal)}</div>
              </div>
              {other.length > 0 && (
                <div className='ptv-nav-group'>
                  {!isCollapsed && <p className='px-4 pb-2 text-xs font-medium opacity-60'>观看工具</p>}
                  <div className='space-y-1'>{renderItems(other)}</div>
                </div>
              )}
            </nav>
            {!isCollapsed && !isUnderPath && <SidebarResume key={pathname} />}
          </div>
        </aside>
        <div className='sidebar-offset' />
      </div>
    </SidebarContext.Provider>
  );
};
export default Sidebar;
