'use client';

import { BookmarkCheck, CircleMinus, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { deleteBookShelf, getAllBookShelf } from '@/lib/book.db.client';
import { BookShelfItem } from '@/lib/book.types';
import {
  buildBookDetailPath,
  cacheBookShelfItem,
} from '@/lib/book-route-cache.client';
import { cn } from '@/lib/cn';
import { processImageUrl } from '@/lib/utils';

import { bookCardItem } from '@/components/media/adapters';
import BooksPagination from '@/components/books/BooksPagination';
import EmptyState from '@/components/media/EmptyState';
import { LIBRARY_ACCENT_ICON, LIBRARY_FIELD, LIBRARY_MUTED } from '@/components/media/library';
import MediaGrid from '@/components/media/MediaGrid';
import MediaGridSkeleton from '@/components/media/MediaGridSkeleton';
import MediaPressCard from '@/components/media/MediaPressCard';

export default function BookShelfPage() {
  const router = useRouter();
  const [shelf, setShelf] = useState<Record<string, BookShelfItem>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    getAllBookShelf()
      .then(setShelf)
      .catch(() => setError('书架读取失败，请稍后刷新重试'))
      .finally(() => setLoading(false));
  }, []);

  const items = useMemo(
    () =>
      Object.values(shelf).sort(
        (a, b) =>
          (b.lastReadTime || b.saveTime) - (a.lastReadTime || a.saveTime)
      ),
    [shelf]
  );

  const removeFromShelf = async (item: BookShelfItem) => {
    await deleteBookShelf(item.sourceId, item.bookId);
    setShelf((prev) => {
      const next = { ...prev };
      delete next[`${item.sourceId}+${item.bookId}`];
      return next;
    });
  };

  const filtered = items.filter((item) => (item.title + ' ' + (item.author || '')).toLowerCase().includes(filter.trim().toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 48)));

  return (
    <section className='f1-reading-collection space-y-4'>
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', LIBRARY_MUTED)}>
        <BookmarkCheck className={cn('h-4 w-4', LIBRARY_ACCENT_ICON)} />共{' '}
        {items.length} 本电子书
        <span className='text-xs'>· 长按封面可移出书架</span>
      </div>

      <input aria-label='筛选书架书籍' placeholder='查找书架中的书名或作者' value={filter}
        onChange={(event) => { setFilter(event.target.value); setPage(1); }} className={cn(LIBRARY_FIELD, 'min-h-11 text-base sm:max-w-md')} />
      {error && <p role='alert' className='text-sm text-red-700 dark:text-red-300'>{error}</p>}

      {loading ? (
        <MediaGridSkeleton count={12} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookmarkCheck className='h-7 w-7' />}
          title='书架还是空的'
          description='在详情页点「加入书架」，收藏的电子书会排到这里。'
        />
      ) : (
        <MediaGrid className='sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'>
          {filtered.slice((currentPage - 1) * 48, currentPage * 48).map((item) => {
            const detailHref = buildBookDetailPath(item.sourceId, item.bookId);
            const openDetail = () => {
              void cacheBookShelfItem(item);
              router.push(detailHref);
            };
            return (
              <MediaPressCard
                key={`${item.sourceId}-${item.bookId}`}
                item={bookCardItem(item)}
                href={detailHref}
                onNavigate={() => void cacheBookShelfItem(item)}
                onPress={openDetail}
                title={item.title}
                poster={item.cover ? processImageUrl(item.cover) : undefined}
                sourceName={item.sourceName}
                actions={[
                  {
                    id: 'detail',
                    label: '详情',
                    icon: <Info size={20} />,
                    onClick: openDetail,
                  },
                  {
                    id: 'remove-from-shelf',
                    label: '移出书架',
                    icon: <CircleMinus size={20} />,
                    onClick: () => void removeFromShelf(item),
                    color: 'danger' as const,
                  },
                ]}
              />
            );
          })}
        </MediaGrid>
      )}
      {!loading && items.length > 0 && !filtered.length && <EmptyState title='没有匹配的书籍' description='试试其他书名或作者。' />}
      <BooksPagination page={currentPage} total={filtered.length} pageSize={48} onChange={setPage} />
    </section>
  );
}
