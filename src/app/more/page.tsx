'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { useNavigationItems } from '@/components/NavigationItems';
import PageLayout from '@/components/PageLayout';

export default function MorePage() {
  const { primary, categories, other } = useNavigationItems();
  const features = [...primary.filter((item) => ['/music/rankings', '/live', '/web-live'].includes(item.href)), ...other];
  return (
    <PageLayout activePath='/more'>
      <div className='ptv-more mx-auto max-w-5xl px-5 py-10 sm:px-8'>
        <p className='text-sm font-medium tracking-widest opacity-60'>DISCOVER</p>
        <h1 className='mt-2 text-3xl font-bold'>更多</h1>
        {features.length > 0 && <section className='mt-8'><h2 className='mb-3 text-lg font-semibold'>功能</h2><div className='grid gap-3 sm:grid-cols-2'>{features.map(({ icon: Icon, label, href }) => (
          <Link key={href} href={href} className='ptv-more-card flex min-h-16 items-center gap-4 rounded-xl border p-4'><Icon className='h-5 w-5' /><span className='flex-1 font-medium'>{label}</span><ChevronRight className='h-4 w-4 opacity-50' /></Link>
        ))}</div></section>}
        <section className='mt-8'><h2 className='mb-3 text-lg font-semibold'>影视分类</h2><div className='grid gap-3 sm:grid-cols-2'>{categories.map(({ icon: Icon, label, href }) => (
          <Link key={href} href={href} className='ptv-more-card flex min-h-16 items-center gap-4 rounded-xl border p-4'><Icon className='h-5 w-5' /><span className='flex-1 font-medium'>{label}</span><ChevronRight className='h-4 w-4 opacity-50' /></Link>
        ))}</div></section>
      </div>
    </PageLayout>
  );
}
