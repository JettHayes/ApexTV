'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';

import { SPECIAL_SOURCE_PATH } from '@/lib/special-source.client';

import BrandLogo from './BrandLogo';
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
  const { primary, categories, other } = useNavigationItems(isUnderPath ? SPECIAL_SOURCE_PATH : '/search');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasSavedChoice, setHasSavedChoice] = useState(false);

  useLayoutEffect(() => {
    const media = window.matchMedia('(min-width: 768px) and (max-width: 1199px)');
    const update = () => {
      const saved = localStorage.getItem('sidebarCollapsed');
      const explicit = saved === 'true' || saved === 'false';
      setHasSavedChoice(explicit);
      const collapsed = explicit ? saved === 'true' : media.matches;
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
    setIsCollapsed(next);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
    setHasSavedChoice(true);
    window.__sidebarCollapsed = next;
    onToggle?.(next);
  }, [isCollapsed, onToggle]);

  const resetChoice = () => {
    localStorage.removeItem('sidebarCollapsed');
    const next = window.matchMedia('(min-width: 768px) and (max-width: 1199px)').matches;
    setHasSavedChoice(false);
    setIsCollapsed(next);
    window.__sidebarCollapsed = next;
    onToggle?.(next);
  };

  if (pathname === '/watch-room/screen') return null;

  const renderItems = (items: typeof primary) => items.map(({ icon: Icon, label, href }) => {
    const active = navigationActive(pathname, searchParams.toString(), href);
    return (
      <Link key={href} href={href} prefetch={false} title={isCollapsed ? label : undefined}
        aria-label={label} aria-current={active ? 'page' : undefined} data-active={active}
        className='ptv-nav-link flex min-h-11 items-center gap-3 rounded-lg px-4 text-sm font-medium transition-colors'>
        <Icon className='h-5 w-5 shrink-0' aria-hidden='true' />
        {!isCollapsed && <span className='truncate'>{label}</span>}
      </Link>
    );
  });

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <div className='hidden md:flex'>
        <aside data-sidebar data-collapsed={isCollapsed} className={`ptv-sidebar fixed left-0 top-0 z-40 h-screen border-r transition-[width] duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
          <div className='flex h-full flex-col'>
            <div className='flex h-16 items-center justify-between gap-2 px-3'>
              {!isCollapsed && <BrandLogo />}
              <button type='button' onClick={handleToggle} aria-label={isCollapsed ? '展开导航' : '收起导航'} aria-expanded={!isCollapsed}
                className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'>
                <Menu className='h-5 w-5' />
              </button>
            </div>
            <nav aria-label='主导航' className='flex-1 overflow-y-auto px-2 pb-4'>
              <div className='space-y-1'>{renderItems(primary)}</div>
              <div className='mt-6 border-t pt-4'>
                {!isCollapsed && <p className='px-4 pb-2 text-xs font-medium opacity-60'>影视分类</p>}
                <div className='space-y-1'>{renderItems(categories)}</div>
              </div>
              {other.length > 0 && <div className='mt-4 border-t pt-4 space-y-1'>{renderItems(other)}</div>}
              {hasSavedChoice && !isCollapsed && <button type='button' onClick={resetChoice} className='mt-6 px-4 py-2 text-xs opacity-60 hover:opacity-100'>恢复默认导航宽度</button>}
            </nav>
          </div>
        </aside>
        <div className='sidebar-offset' />
      </div>
    </SidebarContext.Provider>
  );
};
export default Sidebar;
