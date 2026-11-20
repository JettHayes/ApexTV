'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getAllFavorites,
  getAllPlayRecords,
  getCachedPlayRecordsSnapshot,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import type { Favorite, PlayRecord } from '@/lib/db.client';
import { emptyPersonalLibrary } from '@/lib/personal-library';
import {
  loadPersonalLibrary,
  PERSONAL_LIBRARY_UPDATED,
  personalLibrarySnapshot,
} from '@/lib/personal-library.client';

export function usePersonalLibrary() {
  const [favorites, setFavorites] = useState<Record<string, Favorite>>({});
  const [records, setRecords] = useState<Record<string, PlayRecord>>({});
  const [library, setLibrary] = useState(emptyPersonalLibrary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const onLibrary = () => {
      if (active) setLibrary(personalLibrarySnapshot());
    };
    const offFavorites = subscribeToDataUpdates<Record<string, Favorite>>(
      'favoritesUpdated',
      (data) => {
        if (active) setFavorites(data);
      }
    );
    const offRecords = subscribeToDataUpdates<Record<string, PlayRecord>>(
      'playRecordsUpdated',
      (data) => {
        if (active) setRecords(data);
      }
    );
    window.addEventListener(PERSONAL_LIBRARY_UPDATED, onLibrary);
    const storage = () => {
      loadPersonalLibrary().catch(() => {
        if (active) setError('整理数据读取失败，请重试');
      });
    };
    window.addEventListener('storage', storage);
    setRecords(getCachedPlayRecordsSnapshot());
    setLoading(true);
    setError('');
    Promise.allSettled([
      getAllFavorites().then((data) => {
        if (active) setFavorites(data);
      }),
      getAllPlayRecords().then((data) => {
        if (active) setRecords(data);
      }),
      loadPersonalLibrary().then((data) => {
        if (active) setLibrary(data);
      }),
    ])
      .then((results) => {
        const failed = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected'
        );
        if (active && failed)
          setError(
            failed.reason instanceof Error
              ? failed.reason.message
              : '部分内容加载失败，请重试'
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      offFavorites();
      offRecords();
      window.removeEventListener(PERSONAL_LIBRARY_UPDATED, onLibrary);
      window.removeEventListener('storage', storage);
    };
  }, [refresh]);
  return {
    favorites,
    records,
    library,
    loading,
    error,
    reload: useCallback(() => setRefresh((value) => value + 1), []),
  };
}
