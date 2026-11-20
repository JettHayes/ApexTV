'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { useNavigationItems } from '@/components/NavigationItems';
import PageLayout from '@/components/PageLayout';

export default function MorePage() {
  const { primary, categories, personal, other } = useNavigationItems();
  const reading = primary.filter((item) => ['/music/rankings', '/books', '/manga'].includes(item.href));
  const features = [...primary.filter((item) => ['/live', '/web-live'].includes(item.href)), ...other];
  const sections = [
    { title: '我的', items: personal },
    { title: '音乐与阅读', items: reading },
    { title: '直播与更多', items: features },
    { title: '影视分类', items: categories },
  ];
  return (
    <PageLayout activePath='/more'>
      <div className='ptv-more apex-more-page'>
        <div className='apex-page-heading'><h1>更多</h1><p>音乐、阅读与更多观看方式</p></div>
        {sections.filter((section) => section.items.length > 0).map(({ title, items }) => (
          <section key={title} className='mt-8' aria-label={title}>
            <h2 className='mb-3 text-lg font-semibold'>{title}</h2>
            <div className='apex-destination-grid'>
              {items.map(({ icon: Icon, label, href }) => (
                <Link key={href} href={href} prefetch={false} className='ptv-more-card flex min-h-16 items-center gap-4 rounded-xl border p-4'>
                  <Icon className='h-5 w-5' aria-hidden='true' />
                  <span className='flex-1 font-medium'>{label}</span>
                  <ChevronRight className='h-4 w-4 opacity-50' aria-hidden='true' />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
