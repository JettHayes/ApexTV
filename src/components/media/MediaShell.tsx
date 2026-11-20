'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import {
  LIBRARY_FOCUS,
  LIBRARY_ICON_BUTTON_GHOST,
  LIBRARY_MUTED,
  LIBRARY_PAGE,
  LIBRARY_SERIF,
  LIBRARY_TEXT,
  SPINE_TAB_ACTIVE,
  SPINE_TAB_IDLE,
} from '@/components/media/library';
import PageLayout from '@/components/PageLayout';

export interface MediaShellTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * 漫画与小说共用的页面外壳（顶栏 + 二级 tab + 移动端底栏）。
 *
 * 两套功能仍然各有自己的外壳实例与作用域，这里只是把重复的 200 余行收敛成一份。
 * 书库页复用全站主导航与内容边距，阅读页保留独立顶栏和阅读操作。阅读页与
 * 书库页共用同一套外壳，区别只剩两处——阅读页把二级 tab 换成阅读器动作按钮，
 * 内容区用各功能自己的 reader.mainClassName。
 */
export default function MediaShell({
  children,
  siteName,
  title,
  subtitle,
  backHref,
  tabs,
  reader,
}: {
  children: React.ReactNode;
  siteName: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  tabs: MediaShellTab[];
  reader?: {
    actions: React.ReactNode;
    /** 阅读页内容区的完整样式，由各功能保持原值，避免阅读页布局回归 */
    mainClassName: string;
  };
}) {
  const pathname = usePathname();
  const isReader = Boolean(reader);
  const isActive = (href: string) => pathname === href;

  const shell = (
    <div
      className={cn(
        isReader ? 'ptv-library min-h-screen' : 'ptv-library apex-media-shell',
        LIBRARY_PAGE,
        LIBRARY_TEXT
      )}
    >
      <header
        className={
          isReader
            ? 'fixed inset-x-0 top-0 z-40 border-b border-library-edge bg-library-paper/95 dark:border-library-night-edge dark:bg-library-night/95'
            : 'apex-media-header'
        }
        style={isReader ? { paddingTop: 'var(--safe-top)' } : undefined}
      >
        <div
          className={
            isReader
              ? 'mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:h-16 sm:px-6'
              : 'apex-media-header-inner'
          }
        >
          <div
            className={
              isReader
                ? 'flex min-w-0 flex-1 items-center gap-2'
                : 'apex-media-title'
            }
          >
            {backHref ? (
              <Link
                href={backHref}
                aria-label='返回'
                className={cn(LIBRARY_ICON_BUTTON_GHOST, LIBRARY_FOCUS)}
              >
                <ChevronLeft className='h-5 w-5' />
              </Link>
            ) : isReader ? (
              <Link
                href='/'
                className={cn(
                  'flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-semibold transition-colors duration-200',
                  LIBRARY_SERIF,
                  'text-library-ochre hover:bg-library-ochre-tint dark:text-library-night-ochre dark:hover:bg-library-night-ochre-tint',
                  LIBRARY_FOCUS
                )}
              >
                {siteName}
              </Link>
            ) : null}
            <div className='min-w-0'>
              <div
                className={cn(
                  'truncate text-sm font-semibold sm:text-base',
                  LIBRARY_SERIF
                )}
                title={title}
              >
                {title}
              </div>
              {subtitle && (
                <div className={cn('truncate text-xs', LIBRARY_MUTED)}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {isReader ? (
            <div className='ml-auto flex shrink-0 items-center gap-1'>
              {reader?.actions}
            </div>
          ) : (
            <>
              <nav className='apex-media-tabs' aria-label='阅读导航'>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = isActive(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors duration-200',
                        LIBRARY_FOCUS,
                        active ? SPINE_TAB_ACTIVE : SPINE_TAB_IDLE
                      )}
                    >
                      <Icon className='h-4 w-4' />
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
            </>
          )}
        </div>
      </header>

      <div
        role={isReader ? 'main' : undefined}
        className={cn(
          reader
            ? cn('mx-auto max-w-7xl', reader.mainClassName)
            : 'apex-media-main'
        )}
      >
        {children}
      </div>
    </div>
  );

  return isReader ? (
    shell
  ) : (
    <PageLayout activePath={tabs[0]?.href}>{shell}</PageLayout>
  );
}
