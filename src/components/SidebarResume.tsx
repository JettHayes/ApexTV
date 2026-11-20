'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getAllPlayRecords,
  getCachedPlayRecordsSnapshot,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import type { PlayRecord } from '@/lib/db.client';
import {
  libraryPlaybackUrl,
  recordProgress,
  videoFromRecord,
} from '@/lib/personal-library';
import LibraryPoster from './LibraryPoster';
import './PersonalLibrary.css';

export default function SidebarResume() {
  const [records, setRecords] = useState<Record<string, PlayRecord>>({});
  useEffect(() => {
    let active = true;
    const off = subscribeToDataUpdates<Record<string, PlayRecord>>(
      'playRecordsUpdated',
      (data) => {
        if (active) setRecords(data);
      }
    );
    const cached = getCachedPlayRecordsSnapshot();
    setRecords(cached);
    // 复用现有记录缓存和更新事件，不轮询、不加载视频。
    if (!Object.keys(cached).length)
      getAllPlayRecords()
        .then((data) => {
          if (active) setRecords(data);
        })
        .catch(() => {});
    return () => {
      active = false;
      off();
    };
  }, []);
  const recent = Object.entries(records)
    .filter(
      ([, record]) =>
        record.origin !== 'live' &&
        record.play_time > 0 &&
        recordProgress(record) < 98
    )
    .sort(([, a], [, b]) => b.save_time - a.save_time)[0];
  if (!recent) return null;
  const [key, record] = recent,
    video = videoFromRecord(key, record);
  if (!video) return null;
  return (
    <Link
      className='my-resume'
      href={libraryPlaybackUrl(video, record)}
      prefetch={false}
      aria-label={'继续观看 ' + record.title}
    >
      <span className='my-resume-art'>
        <LibraryPoster src={record.cover} title={record.title} />
      </span>
      <span className='my-resume-copy'>
        <small>继续观看</small>
        <strong>{record.title}</strong>
        <span>
          {record.total_episodes > 1 ? '第 ' + record.index + ' 集 · ' : ''}已看{' '}
          {Math.floor(record.play_time / 60)} 分钟
        </span>
        <span className='my-resume-track'>
          <i style={{ width: recordProgress(record) + '%' }} />
        </span>
      </span>
    </Link>
  );
}
