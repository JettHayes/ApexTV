'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { smoothScrollBehavior } from '@/lib/motion';

import {
  LIBRARY_GHOST_BUTTON,
  LIBRARY_MUTED,
} from '@/components/media/library';

export default function BooksPagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  const current = Math.min(page, pages);
  const changePage = (next: number) => {
    onChange(next);
    window.scrollTo({ top: 0, behavior: smoothScrollBehavior() });
  };
  return (
    <nav
      aria-label='书籍列表分页'
      className='flex flex-wrap items-center justify-between gap-3 border-t border-library-edge pt-5 dark:border-library-night-edge'
    >
      <span className={'text-sm tabular-nums ' + LIBRARY_MUTED}>
        {current} / {pages} 页 · 共 {total} 项
      </span>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          aria-label='上一页'
          disabled={current <= 1}
          onClick={() => changePage(current - 1)}
          className={
            LIBRARY_GHOST_BUTTON +
            ' min-h-11 disabled:cursor-not-allowed disabled:opacity-40'
          }
        >
          <ChevronLeft className='h-4 w-4' />
          上一页
        </button>
        <button
          type='button'
          aria-label='下一页'
          disabled={current >= pages}
          onClick={() => changePage(current + 1)}
          className={
            LIBRARY_GHOST_BUTTON +
            ' min-h-11 disabled:cursor-not-allowed disabled:opacity-40'
          }
        >
          下一页
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>
    </nav>
  );
}
