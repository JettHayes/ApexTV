'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { useNavigationItems } from '@/components/NavigationItems';
import PageLayout from '@/components/PageLayout';

export default function MorePage() {
  const { primary, categories, personal, other } = useNavigationItems();
  const common = primary.filter((item) => ['/music/rankings', '/books', '/manga'].includes(item.href));
  const sections = [
    { title: '', items: common },
    { title: '影视分类', items: categories },
    { title: '我的', items: personal },
    { title: '观看工具', items: other },
  ];
  return (
    <PageLayout activePath='/more'>
      <div className='ptv-more apex-more-page f1-more-page'>
        <div className='apex-page-heading'><h1>更多</h1><p>音乐、阅读与更多观看方式</p></div>
        {sections.filter((section) => section.items.length > 0).map(({ title, items }) => (
          <section key={title} className='mt-8' aria-label={title || '常用功能'}>
            {title && <h2 className='mb-3 text-lg font-semibold'>{title}</h2>}
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
