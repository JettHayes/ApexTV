'use client';

import { CheckCircle2, Compass, Search, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { getAllBookReadRecords } from '@/lib/book.db.client';
import { BookReadRecord, BookSource } from '@/lib/book.types';
import { buildBookReadPath } from '@/lib/book-route-cache.client';
import { cn } from '@/lib/cn';

import ContinueReadingCard from '@/components/media/ContinueReadingCard';
import BooksPagination from '@/components/books/BooksPagination';
import EmptyState from '@/components/media/EmptyState';
import {
  BOOK_RAIL_ITEM,
  LIBRARY_BUTTON,
  LIBRARY_FIELD,
  LIBRARY_GHOST_BUTTON,
  LIBRARY_MUTED,
  LIBRARY_PANEL,
  LIBRARY_SERIF,
} from '@/components/media/library';
import MediaCard from '@/components/media/MediaCard';
import MediaRail from '@/components/media/MediaRail';
import MediaSectionHeader from '@/components/media/MediaSectionHeader';

function SourceCardSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={cn(LIBRARY_PANEL, 'p-5')}>
          <div className='h-5 w-32 animate-pulse rounded-sm bg-library-edge dark:bg-library-night-edge' />
          <div className='mt-3 flex gap-2'>
            <div className='h-6 w-16 animate-pulse rounded-sm bg-library-edge dark:bg-library-night-edge' />
            <div className='h-6 w-16 animate-pulse rounded-sm bg-library-edge dark:bg-library-night-edge' />
          </div>
          <div className='mt-5 flex gap-2'>
            <div className='h-10 w-24 animate-pulse rounded-md bg-library-edge dark:bg-library-night-edge' />
            <div className='h-10 w-24 animate-pulse rounded-md bg-library-edge dark:bg-library-night-edge' />
          </div>
        </div>
      ))}
    </div>
  );
}

function CapabilityPill({
  enabled,
  children,
}: {
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const Icon = enabled ? CheckCircle2 : XCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs ring-1',
        enabled
          ? 'bg-library-ochre-tint text-library-ochre ring-library-ochre/25 dark:bg-library-night-ochre-tint dark:text-library-night-ochre dark:ring-library-night-ochre/25'
          : 'text-library-muted ring-library-edge dark:text-library-night-muted dark:ring-library-night-edge'
      )}
    >
      <Icon className='h-3.5 w-3.5' />
      {children}
    </span>
  );
}

function readRecordMeta(record: BookReadRecord) {
  return [record.sourceName, record.chapterTitle, record.author]
    .filter(Boolean)
    .join(' · ');
}

export default function BooksHomePage() {
  const [sources, setSources] = useState<BookSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readRecords, setReadRecords] = useState<BookReadRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [capability, setCapability] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      !(window as Window & { RUNTIME_CONFIG?: { BOOKS_ENABLED?: boolean } })
        .RUNTIME_CONFIG?.BOOKS_ENABLED
    ) {
      window.location.href = '/';
      return;
    }
    fetch('/api/books/sources')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '加载书源失败');
        return json;
      })
      .then((data) => setSources(data.sources || []))
      .catch((err) => setError(err.message || '加载书源失败'))
      .finally(() => setLoading(false));

    getAllBookReadRecords()
      .then((records) =>
        setReadRecords(
          Object.values(records).sort((a, b) => b.saveTime - a.saveTime)
        )
      )
      .catch(() => undefined);
  }, []);

  const currentRecord = readRecords[0];
  // 顶部「正在读」大卡已经摊开第一本，这里只列其余的，避免同一本重复出现。
  const recentRecords = readRecords.slice(1, 13);
  const filteredSources = useMemo(() => sources.filter((source) =>
    source.name.toLowerCase().includes(filter.trim().toLowerCase()) &&
    (capability === 'all' || (capability === 'catalog' ? source.capabilities?.catalogSupported : source.capabilities?.searchSupported))
  ), [sources, filter, capability]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredSources.length / 24)));

  return (
    <div className='space-y-8'>
      {currentRecord ? (
        <ContinueReadingCard
          title={currentRecord.title}
          image={currentRecord.cover}
          meta={readRecordMeta(currentRecord)}
          progress={currentRecord.progressPercent}
          href={buildBookReadPath(
            currentRecord.sourceId,
            currentRecord.bookId,
            currentRecord.chapterHref
          )}
        />
      ) : (
        <section
          className={cn(
            LIBRARY_PANEL,
            'flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6'
          )}
        >
          <div className='min-w-0'>
            <h1
              className={cn(
                'text-xl font-semibold text-library-ink dark:text-library-night-ink',
                LIBRARY_SERIF
              )}
            >
              从这里开始阅读
            </h1>
            <p className={cn('mt-1.5 text-sm', LIBRARY_MUTED)}>
              选择一个书源开始浏览，或直接搜索书名与作者。
            </p>
          </div>
          <Link href='/books/search' className={LIBRARY_BUTTON}>
            <Search className='h-4 w-4' />
            搜索书籍
          </Link>
        </section>
      )}

      {recentRecords.length > 0 ? (
        <MediaRail title='最近在读'>
          {recentRecords.map((record) => (
            <div
              key={`${record.sourceId}-${record.bookId}`}
              className={BOOK_RAIL_ITEM}
            >
              <MediaCard
                item={{
                  key: `${record.sourceId}-${record.bookId}`,
                  title: record.title,
                  image: record.cover,
                  progress: record.progressPercent,
                }}
                href={buildBookReadPath(
                  record.sourceId,
                  record.bookId,
                  record.chapterHref
                )}
              />
            </div>
          ))}
        </MediaRail>
      ) : null}

      <section className='space-y-4'>
        <MediaSectionHeader
          title='书源'
          subtitle={
            loading ? '正在加载书源…' : `共 ${sources.length} 个可用书源`
          }
          action={
            currentRecord ? (
              <Link href='/books/search' className={LIBRARY_GHOST_BUTTON}>
                <Search className='h-3.5 w-3.5' />
                搜索书籍
              </Link>
            ) : undefined
          }
        />

        {loading ? <SourceCardSkeleton /> : null}

        {error ? <EmptyState tone='error' description={error} /> : null}

        {!loading && sources.length > 0 && <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]'>
          <label className='min-w-0'>
            <span className={cn('mb-2 block text-xs', LIBRARY_MUTED)}>查找书源</span>
            <input aria-label='筛选书源名称' placeholder='按书源名称筛选' value={filter}
              onChange={(event) => { setFilter(event.target.value); setPage(1); }} className={cn(LIBRARY_FIELD, 'min-h-11 text-base')} />
          </label>
          <label>
            <span className={cn('mb-2 block text-xs', LIBRARY_MUTED)}>规则类型</span>
            <select aria-label='筛选书源规则类型' value={capability} onChange={(event) => { setCapability(event.target.value); setPage(1); }}
              className={cn(LIBRARY_FIELD, 'min-h-11 text-base')}>
              <option value='all'>全部书源</option><option value='search'>已配置搜索</option><option value='catalog'>已配置目录</option>
            </select>
          </label>
        </div>}

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {filteredSources.slice((currentPage - 1) * 24, currentPage * 24).map((source) => (
            <article key={source.id} className={cn(LIBRARY_PANEL, 'p-5')}>
              <div className='min-w-0'>
                <div
                  className={cn(
                    'truncate text-base font-semibold text-library-ink dark:text-library-night-ink',
                    LIBRARY_SERIF
                  )}
                >
                  {source.name}
                </div>
                <div className={cn('mt-1 text-xs font-medium', LIBRARY_MUTED)}>
                  {source.type === 'legado' ? 'Legado' : 'OPDS'}
                </div>
              </div>

              <div className='mt-4 flex flex-wrap gap-2'>
                <CapabilityPill enabled={source.capabilities?.catalogSupported}>
                  {source.capabilities?.catalogSupported ? '已配置目录' : '无目录规则'}
                </CapabilityPill>
                <CapabilityPill enabled={source.capabilities?.searchSupported}>
                  {source.capabilities?.searchSupported ? '已配置搜索' : source.legado?.searchUrl ? '搜索规则待适配' : '无搜索规则'}
                </CapabilityPill>
              </div>

              <div className='mt-5 flex flex-wrap gap-2'>
                {source.capabilities?.catalogSupported && (
                  <Link
                    prefetch={false}
                    href={`/books/catalog?sourceId=${encodeURIComponent(
                      source.id
                    )}`}
                    className={LIBRARY_BUTTON}
                  >
                    浏览目录
                  </Link>
                )}
                {source.capabilities?.searchSupported && (
                  <Link
                    prefetch={false}
                    href={`/books/search?sourceId=${encodeURIComponent(
                      source.id
                    )}`}
                    className={LIBRARY_GHOST_BUTTON}
                  >
                    搜索书籍
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        <BooksPagination page={currentPage} total={filteredSources.length} pageSize={24} onChange={setPage} />
        {!loading && sources.length > 0 && filteredSources.length === 0 && <EmptyState
          title='没有符合筛选条件的书源' description='试试其他名称，或将规则类型切回全部书源。' />}
        {!loading && sources.length > 0 && <p className={cn('text-xs leading-relaxed', LIBRARY_MUTED)}>
          已配置规则表示订阅提供了对应配置，不代表网站当前可访问；搜索时会跳过完全重复的规则。
        </p>}

        {!loading && !error && sources.length === 0 ? (
          <EmptyState
            icon={<Compass className='h-7 w-7' />}
            title='暂无可用书源'
            description='请在管理端配置 OPDS 或 Legado 书源后重试。'
          />
        ) : null}
      </section>
    </div>
  );
}
