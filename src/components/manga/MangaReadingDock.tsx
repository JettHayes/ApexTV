'use client';

import { ArrowRight, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  getAllMangaReadRecords,
  getCachedMangaReadRecordsSnapshot,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { MangaReadRecord } from '@/lib/manga.types';

import { mangaRecordReadHref } from '@/components/media/adapters';
import ProxyImage from '@/components/ProxyImage';

export default function MangaReadingDock() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [record, setRecord] = useState<MangaReadRecord | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const update = (records: Record<string, MangaReadRecord>) => {
      if (!active) return;
      const latest = Object.values(records).reduce<MangaReadRecord | null>(
        (current, item) =>
          !current || item.saveTime > current.saveTime ? item : current,
        null
      );
      setRecord(latest);
    };
    update(getCachedMangaReadRecordsSnapshot());
    const unsubscribe = subscribeToDataUpdates<Record<string, MangaReadRecord>>(
      'mangaHistoryUpdated',
      (records) => {
        revision += 1;
        update(records);
      }
    );
    getAllMangaReadRecords()
      .then((records) => {
        if (revision === 0) update(records);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!record) return null;
  const page = Math.max(0, record.pageIndex) + 1;
  const progress =
    record.pageCount > 0
      ? Math.min(100, Math.round((page / record.pageCount) * 100))
      : undefined;
  const query = searchParams.toString();
  const returnTo = query ? pathname + '?' + query : pathname;
  const href = mangaRecordReadHref(record, returnTo);
  const pageLabel =
    record.pageCount > 0
      ? '第 ' + page + '/' + record.pageCount + ' 页'
      : '第 ' + page + ' 页';

  return (
    <>
      <div
        className='f1-manga-dock-space'
        data-collapsed={collapsed}
        aria-hidden='true'
      />
      <aside
        className='f1-manga-reading-dock'
        data-collapsed={collapsed}
        aria-label='漫画续读栏'
      >
        <Link
          id='manga-resume-content'
          className='f1-manga-dock-link'
          href={href}
          prefetch={false}
          aria-label={
            '继续阅读 ' +
            record.title +
            '，' +
            record.chapterName +
            '，' +
            pageLabel
          }
        >
          <span className='f1-manga-dock-cover'>
            {record.cover ? (
              <ProxyImage originalSrc={record.cover} alt='' />
            ) : (
              <BookOpen size={22} />
            )}
          </span>
          <span className='f1-manga-dock-copy'>
            <span className='f1-manga-dock-kicker'>正在读</span>
            <strong>{record.title}</strong>
            <span className='f1-manga-dock-meta'>
              {record.chapterName} · {pageLabel}
            </span>
          </span>
          <span className='f1-manga-dock-cta'>
            继续阅读 <ArrowRight size={16} aria-hidden='true' />
          </span>
        </Link>
        <button
          type='button'
          className='f1-manga-dock-toggle'
          aria-label={collapsed ? '展开续读栏' : '收起续读栏'}
          aria-expanded={!collapsed}
          aria-controls='manga-resume-content'
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {progress !== undefined && (
          <div
            className='f1-manga-dock-progress'
            role='progressbar'
            aria-label='当前章节阅读进度'
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: progress + '%' }} />
          </div>
        )}
      </aside>
    </>
  );
}
