'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import TVCard from './TVCard';
import { TVSection } from './types';

export default function TVRow({ section }: { section: TVSection }) {
  return (
    <section className='f1-tv-row' data-layout={section.layout || 'poster'}>
      <div className='f1-tv-row-heading flex items-end justify-between gap-4'>
        <div>
          <h2 className='f1-tv-section-heading font-bold tracking-tight'>{section.title}</h2>
          {section.subtitle && <p className='mt-2 text-xl text-slate-400'>{section.subtitle}</p>}
        </div>
        {section.href && (
          <Link href={section.href} className='flex cursor-pointer items-center gap-1 rounded-full px-4 py-2 text-xl font-semibold text-slate-300 outline-none transition hover:bg-white/10 hover:text-white tv-focusable'>
            查看更多 <ChevronRight className='h-6 w-6' />
          </Link>
        )}
      </div>
      <div data-tv-focus-row='horizontal' className='f1-tv-row-track flex gap-5 overflow-x-auto [scrollbar-width:none]'>
        {section.items.map((item) => <TVCard landscape={section.layout === 'continue'} key={`${section.title}-${item.id}`} item={item} />)}
      </div>
    </section>
  );
}
