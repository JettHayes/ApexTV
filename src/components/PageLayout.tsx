'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BackButton, recordNavigation } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { UpdateNotification } from './UpdateNotification';
import { UserMenu } from './UserMenu';
import { VersionCheckProvider } from './VersionCheckProvider';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  hideNavigation?: boolean; // 控制是否隐藏顶部和底部导航栏
}

const PageLayout = ({ children, activePath = '/', hideNavigation = false }: PageLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [backgroundImage, setBackgroundImage] = useState('');
  const shouldShowSharedBackground = !hideNavigation && activePath !== '/play';
  const page = pathname === '/' ? 'home' : pathname.startsWith('/search') ? 'search' : pathname.startsWith('/private-library') ? 'library' : pathname.startsWith('/play') ? 'play' : pathname.startsWith('/live') || pathname.startsWith('/web-live') ? 'live' : pathname.startsWith('/admin') ? 'admin' : 'other';
  const showBackButton = ['/play', '/live', '/web-live'].some((path) => pathname === path || pathname.startsWith(path + '/'));

  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);

  useEffect(() => {
    router.prefetch('/search');
    router.prefetch('/play');
  }, [router]);

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
    <VersionCheckProvider>
      <div className='ptv-page relative w-full min-h-dvh overflow-hidden' data-page={page}>
        {shouldShowSharedBackground && backgroundImage && (
          <>
            <div
              className='ptv-wallpaper absolute inset-0 pointer-events-none'
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
            <div className='ptv-wallpaper-overlay absolute inset-0 pointer-events-none' />
          </>
        )}

        {/* 移动端头部 */}
        {!hideNavigation && (
          <MobileHeader showBackButton={showBackButton} />
        )}

        {/* 主要布局容器 */}
        <div className='relative z-10 flex md:grid md:grid-cols-[auto_1fr] w-full min-h-screen md:min-h-auto'>
          {/* 侧边栏 - 桌面端显示，移动端隐藏 */}
          {!hideNavigation && (
            <div className='hidden md:block'>
              <Sidebar activePath={activePath} />
            </div>
          )}

          {/* 主内容区域 */}
          <div className='relative min-w-0 flex-1 transition-all duration-300'>
            {/* 桌面端左上角返回按钮 */}
            {!hideNavigation && showBackButton && (
              <div className='absolute top-3 left-1 z-20 hidden md:flex'>
                <BackButton />
              </div>
            )}

            {/* 桌面端顶部按钮 */}
            {!hideNavigation && (
              <div className='absolute top-2 right-4 z-20 hidden md:flex items-center gap-2'>
                <ThemeToggle />
                <UserMenu />
                <UpdateNotification />
              </div>
            )}

            {/* 主内容 */}
            <main
              className={hideNavigation ? 'flex-1 md:min-h-0' : 'ptv-page-main flex-1 md:min-h-0'}
            >
              {children}
            </main>
          </div>
        </div>

        {/* 移动端底部导航 */}
        {!hideNavigation && (
          <div className='md:hidden'>
            <MobileBottomNav activePath={activePath} />
          </div>
        )}
      </div>
    </VersionCheckProvider>
  );
};

export default PageLayout;
