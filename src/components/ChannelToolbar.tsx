'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { BackButton } from './BackButton';
import { navigationActive, useNavigationItems } from './NavigationItems';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

/** 频道工具栏只组织现有路由，功能开关继续由原导航模型提供。 */
export default function ChannelToolbar() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const { primary, categories, personal, other } = useNavigationItems();
  const filmChannel = pathname === '/' || pathname === '/douban';
  const current = [...primary, ...personal, ...other].find((item) => navigationActive(pathname, query, item.href));
  const title = pathname.startsWith('/admin') ? '管理工作区'
    : pathname.startsWith('/play') || pathname.startsWith('/duanju/play') ? '正在播放'
    : pathname.startsWith('/duanju') ? '短剧'
    : pathname.startsWith('/source-search') ? '源站寻片'
    : pathname.startsWith('/movie-request') ? '求片'
    : current?.label || 'Apex TV';

  return (
    <header className='f1-channel-toolbar'>
      <div className='f1-channel-context'>
        {!filmChannel && <BackButton />}
        {filmChannel ? (
          <nav className='f1-channel-links' aria-label='影视频道'>
            {[{ href: '/', label: '推荐' }, ...categories].map(({ href, label }) => (
              <Link key={href} href={href} prefetch={false} aria-current={navigationActive(pathname, query, href) ? 'page' : undefined}>{label}</Link>
            ))}
          </nav>
        ) : <span className='f1-channel-name'>{title}</span>}
      </div>
      <div className='f1-channel-actions'>
        <Link href='/search' prefetch={false} aria-label='搜索影片' title='搜索影片' className='f1-icon-button'><Search size={20} aria-hidden /></Link>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
