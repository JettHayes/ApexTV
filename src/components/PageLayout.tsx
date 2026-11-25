'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { recordNavigation } from './BackButton';
import ChannelToolbar from './ChannelToolbar';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  hideNavigation?: boolean; // 控制是否隐藏顶部和底部导航栏
  navigationMode?: 'default' | 'workspace';
}

const PageLayout = ({ children, activePath = '/', hideNavigation = false, navigationMode = 'default' }: PageLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [backgroundImage, setBackgroundImage] = useState('');
  const shouldShowSharedBackground = !hideNavigation && activePath !== '/play' && !pathname.startsWith('/watch-room/screen');
  const page = pathname === '/' ? 'home' : pathname.startsWith('/search') ? 'search' : pathname.startsWith('/music') ? 'music' : pathname.startsWith('/books') || pathname.startsWith('/manga') ? 'reading' : pathname.startsWith('/private-library') || pathname.startsWith('/my/') ? 'library' : pathname.startsWith('/watch-room/screen') ? 'screen-room' : pathname.startsWith('/play') ? 'play' : pathname.startsWith('/live') || pathname.startsWith('/web-live') ? 'live' : pathname.startsWith('/admin') ? 'admin' : 'other';
  const hasSidebar = !hideNavigation && !['/play', '/live', '/web-live', '/duanju/play', '/watch-room/screen', '/watch-room/music', '/admin'].some((path) => pathname === path || pathname.startsWith(path + '/'));
  const showBackButton = ['/play', '/live', '/web-live'].some((path) => pathname === path || pathname.startsWith(path + '/'));

  useEffect(() => {
    document.documentElement.dataset.navigationLayout = hasSidebar ? 'sidebar' : 'top';
    if (!hasSidebar) {
      delete document.documentElement.dataset.sidebarCollapsed;
      window.__sidebarCollapsed = false;
    }
    return () => { delete document.documentElement.dataset.navigationLayout; };
  }, [hasSidebar]);

  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);

  useEffect(() => {
    if (['/music', '/books', '/manga'].some((path) => pathname === path || pathname.startsWith(path + '/'))) return;
    router.prefetch('/search');
    router.prefetch('/play');
  }, [router, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldShowSharedBackground) {
      setBackgroundImage('');
      return;
    }

    const homeBg = (
      window as Window & {
        RUNTIME_CONFIG?: {
          HOME_BACKGROUND_IMAGE?: string;
        };
      }
    ).RUNTIME_CONFIG?.HOME_BACKGROUND_IMAGE;
    if (!homeBg) {
      setBackgroundImage('');
      return;
    }

    const urls = homeBg
      .split('\n')
      .map((url: string) => url.trim())
      .filter((url: string) => url !== '');

    if (urls.length === 0) {
      setBackgroundImage('');
      return;
    }

    const randomIndex = Math.floor(Math.random() * urls.length);
    setBackgroundImage(urls[randomIndex]);
  }, [shouldShowSharedBackground]);

  return (
    <>
      <div className='ptv-page relative w-full min-h-dvh overflow-x-clip' data-page={page} data-navigation={navigationMode} data-layout={hasSidebar ? 'sidebar' : 'top'}>
        {shouldShowSharedBackground && backgroundImage && createPortal(
          <>
            <div
              className='ptv-wallpaper pointer-events-none'
              data-page={page}
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
            <div className='ptv-wallpaper-overlay pointer-events-none' data-page={page} />
          </>,
          document.body
        )}

        {/* 移动端头部 */}
        {!hideNavigation && (
          <MobileHeader showBackButton={showBackButton} />
        )}

        {/* 主要布局容器 */}
        <div className={'relative z-10 flex w-full min-h-screen flex-col' + (hasSidebar ? ' md:flex-row' : '')}>
          {hasSidebar && <Sidebar activePath={activePath} />}
          {/* 主内容区域 */}
          <div className='relative min-w-0 flex-1'>
            {!hideNavigation && <ChannelToolbar sidebar={hasSidebar} />}

            {/* 主内容 */}
            <main
              className={hideNavigation ? 'flex-1 md:min-h-0' : 'ptv-page-main flex-1 md:min-h-0'}
            >
              {children}
            </main>
          </div>
        </div>

        {/* 移动端底部导航 */}
        {!hideNavigation && navigationMode === 'default' && (
          <div className='md:hidden'>
            <MobileBottomNav activePath={activePath} />
          </div>
        )}
      </div>
    </>
  );
};

export default PageLayout;
