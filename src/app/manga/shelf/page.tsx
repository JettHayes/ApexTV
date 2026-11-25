'use client';

import { BookOpen, CircleMinus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { formatAppError, reportAppError } from '@/lib/app-error';
import { cn } from '@/lib/cn';
import {
  deleteMangaShelf,
  getAllMangaShelf,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { MangaShelfItem } from '@/lib/manga.types';

import {
  mangaCardItem,
  mangaSavedDetailHref,
} from '@/components/media/adapters';
import EmptyState from '@/components/media/EmptyState';
import { LIBRARY_ACCENT_ICON, LIBRARY_MUTED } from '@/components/media/library';
import MediaCard from '@/components/media/MediaCard';
import MediaGrid from '@/components/media/MediaGrid';
import MediaGridSkeleton from '@/components/media/MediaGridSkeleton';

export default function MangaShelfPage() {
  const [shelf, setShelf] = useState<Record<string, MangaShelfItem>>({});
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToDataUpdates<Record<string, MangaShelfItem>>(
      'mangaShelfUpdated',
      setShelf
    );

    getAllMangaShelf()
      .then(setShelf)
      .catch((err) => { reportAppError(err, '加载漫画书架'); setError(formatAppError(err, '加载漫画书架')); })
      .finally(() => setLoading(false));

    return unsubscribe;
  }, []);

  const shelfList = useMemo(
    () => Object.entries(shelf).sort(([, a], [, b]) => b.saveTime - a.saveTime),
    [shelf]
  );

  const removeItem = async (sourceId: string, mangaId: string) => {
    const key = `${sourceId}+${mangaId}`;
    setRemoving(key);
    setError('');
    try {
      await deleteMangaShelf(sourceId, mangaId);
      setShelf((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      reportAppError(err, '移出漫画书架'); setError(formatAppError(err, '移出漫画书架'));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className='f1-reading-collection f1-manga-collection space-y-4'>
      <div className='f1-collection-toolbar'>
        <h2>书架</h2>
        <div className='f1-collection-tools'>
          <div className={cn('flex items-center gap-2 text-sm', LIBRARY_MUTED)}>
            <BookOpen className={cn('h-4 w-4', LIBRARY_ACCENT_ICON)} />共{' '}
            {shelfList.length} 本漫画
          </div>
        </div>
      </div>

      {error && (
        <p role='alert' className='f1-manga-action-error'>
          {error}
        </p>
      )}
      {loading ? (
        <MediaGridSkeleton count={12} />
      ) : shelfList.length === 0 ? (
        <EmptyState
          icon={<BookOpen className='h-7 w-7' />}
          title='书架还是空的'
          description='在推荐或搜索页点封面右下角的书签，收藏的漫画会排到这里。'
        />
      ) : (
        <MediaGrid>
          {shelfList.map(([key, item]) => {
            const detailHref = mangaSavedDetailHref(item, '/manga/shelf');
            return (
              <article key={key} className='f1-manga-saved-card'>
                <MediaCard
                  item={{
                    ...mangaCardItem(item),
                    count: item.unreadChapterCount,
                    subtitle:
                      item.unreadChapterCount && item.unreadChapterCount > 0
                        ? `更新至 ${
                            item.latestChapterName || '最新章节'
                          } · 新增 ${item.unreadChapterCount} 话`
                        : item.lastChapterName || item.author || item.status,
                  }}
                  href={detailHref}
                />
                <button
                  type='button'
                  className='f1-manga-card-action'
                  disabled={removing !== null}
                  onClick={() => void removeItem(item.sourceId, item.mangaId)}
                  aria-label={'移出书架：' + item.title}
                >
                  <CircleMinus size={16} aria-hidden='true' />
                  {removing === key ? '正在移出…' : '移出书架'}
                </button>
              </article>
            );
          })}
        </MediaGrid>
      )}
    </section>
  );
}
