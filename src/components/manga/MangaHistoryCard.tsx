'use client';

import {
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Info,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { MangaReadRecord } from '@/lib/manga.types';

import {
  mangaReadRecordCardItem,
  mangaRecordReadHref,
  mangaSavedDetailHref,
} from '@/components/media/adapters';
import MediaCard from '@/components/media/MediaCard';

interface MangaHistoryCardProps {
  item: MangaReadRecord;
  inShelf: boolean;
  onToggleShelf: (item: MangaReadRecord) => void | Promise<void>;
  onDelete: (item: MangaReadRecord) => void | Promise<void>;
}

export default function MangaHistoryCard({
  item,
  inShelf,
  onToggleShelf,
  onDelete,
}: MangaHistoryCardProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const readHref = mangaRecordReadHref(item, '/manga/history');
  const detailHref = mangaSavedDetailHref(item, '/manga/history');
  const handleAction = async (action: typeof onDelete) => {
    setPending(true);
    setError('');
    try {
      await action(item);
    } catch {
      setError('操作失败，请稍后重试。');
    } finally {
      setPending(false);
    }
  };

  return (
    <article className='f1-manga-saved-card'>
      <MediaCard
        item={{
          ...mangaReadRecordCardItem(item),
          progress:
            item.pageCount > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(((item.pageIndex + 1) / item.pageCount) * 100)
                  )
                )
              : undefined,
        }}
        href={readHref}
      />
      <div className='f1-manga-card-actions'>
        <Link href={readHref} className='f1-manga-card-action'>
          <BookOpen size={15} />
          继续阅读
        </Link>
        <Link href={detailHref} className='f1-manga-card-action'>
          <Info size={15} />
          详情
        </Link>
        <button
          type='button'
          disabled={pending}
          className='f1-manga-card-action'
          onClick={() => void handleAction(onToggleShelf)}
        >
          {inShelf ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
          {inShelf ? '移出书架' : '加入书架'}
        </button>
        <button
          type='button'
          disabled={pending}
          className='f1-manga-card-action'
          onClick={() => void handleAction(onDelete)}
        >
          <Trash2 size={15} />
          移除记录
        </button>
      </div>
      {error && (
        <p role='alert' className='f1-manga-action-error'>
          {error}
        </p>
      )}
    </article>
  );
}
