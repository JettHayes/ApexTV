'use client';

import { ChevronDown, Ellipsis, Film, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import BrandLogo from './BrandLogo';
import { navigationActive, useNavigationItems } from './NavigationItems';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

type NavigationLink = ReturnType<typeof useNavigationItems>['primary'][number];

/** The public shell follows the reference's horizontal navigation; feature gates stay in the shared model. */
export default function ChannelToolbar({ sidebar = false }: { sidebar?: boolean }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const { primary, categories, personal, other } = useNavigationItems();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const isWorkspace = pathname.startsWith('/admin');
  const isPlayback = ['/play', '/live', '/web-live', '/duanju/play'].some((path) => pathname === path || pathname.startsWith(path + '/'));
  const morePrimary = primary.filter((item) => !['/', '/search'].includes(item.href));
  const topCategories = categories.filter((item) => !['/douban?type=custom', '/duanju'].includes(item.href));
  const moreCategories = categories.filter((item) => ['/douban?type=custom', '/duanju'].includes(item.href));
  const moreItems = [...morePrimary, ...moreCategories, ...personal, ...other];

  useEffect(() => setOpenMenu(null), [pathname, query]);

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      headerRef.current?.querySelector<HTMLElement>(`[data-nav-menu="${openMenu}"] > summary`)?.focus();
      setOpenMenu(null);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenu]);

  const isActive = (href: string) => navigationActive(pathname, query, href);
  const navLink = (item: NavigationLink, className = '') => {
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} prefetch={false}
        className={`f1-site-link ${className}`}
        aria-current={isActive(item.href) ? 'page' : undefined}>
        <Icon size={18} className='f1-nav-icon' aria-hidden />
        <span>{item.label}</span>
      </Link>
    );
  };
  const menuLink = (item: NavigationLink, className = '') => {
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} prefetch={false} className={`f1-site-menu-link ${className}`}
      onClick={() => setOpenMenu(null)} aria-current={isActive(item.href) ? 'page' : undefined}>
      <Icon size={17} aria-hidden /><span>{item.label}</span>
    </Link>;
  };
  const dropdown = (key: 'films' | 'more', label: string, active: boolean, children: React.ReactNode) => {
    const Icon = { films: Film, more: Ellipsis }[key];
    return (
    <details className='f1-site-dropdown' data-nav-menu={key} data-active={active} open={openMenu === key}>
      <summary onClick={(event) => { event.preventDefault(); setOpenMenu((current) => current === key ? null : key); }}
        aria-expanded={openMenu === key}>
        <Icon size={18} className='f1-nav-icon' aria-hidden /><span>{label}</span><ChevronDown size={13} aria-hidden />
      </summary>
      <div className='f1-site-menu'>{children}</div>
    </details>
    );
  };

  return (
    <header ref={headerRef} className='f1-channel-toolbar f1-site-header' data-layout={sidebar ? 'sidebar' : 'top'} data-workspace={isWorkspace} data-playback={isPlayback}>
      <div className='f1-site-header-inner'>
        {!sidebar && <div className='f1-site-brand'><BrandLogo /></div>}
        {sidebar ? null : isWorkspace ? (
          <div className='f1-site-workspace'><span>管理后台</span><Link href='/' prefetch={false}>返回站点</Link></div>
        ) : (
          <nav className='f1-site-navigation' aria-label='主导航'>
            {navLink(primary[0])}
            {navLink(primary[1], 'f1-site-search-link')}
            <div className='f1-playback-category-links'>{topCategories.map((item) => navLink(item))}</div>
            <div className='f1-playback-category-menu'>{dropdown('films', '影视', topCategories.some((item) => isActive(item.href)), topCategories.map((item) => menuLink(item)))}</div>
            {dropdown('more', '更多', moreItems.some((item) => isActive(item.href)), <>
              {morePrimary.map((item) => menuLink(item))}
              {moreCategories.map((item) => menuLink(item))}
              <span className='f1-site-menu-label'>我的</span>
              {personal.map((item) => menuLink(item))}
              {other.map((item) => menuLink(item))}
            </>)}
          </nav>
        )}
        <div className='f1-channel-actions'>
          {!sidebar && <Link href='/search' prefetch={false} aria-label='搜索影片' title='搜索影片' className='f1-icon-button f1-top-search-compact'><Search size={20} aria-hidden /></Link>}
          <ThemeToggle />
          <UserMenu quickActions />
        </div>
      </div>
    </header>
  );
}
