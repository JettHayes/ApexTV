'use client';

import { useCallback, useEffect, useState } from 'react';

import { formatAppError, reportAppError } from '@/lib/app-error';
import type { Favorite, PlayRecord } from '@/lib/db.client';
import {
  getAllFavorites,
  getAllPlayRecords,
  getCachedPlayRecordsSnapshot,
  subscribeToDataUpdates,
} from '@/lib/db.client';
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
      loadPersonalLibrary().catch((reason) => {
        if (active) { reportAppError(reason, '读取个人资料库'); setError(formatAppError(reason, '读取个人资料库')); }
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
        if (active && failed) {
          reportAppError(failed.reason, '加载个人资料库');
          setError(formatAppError(failed.reason, '加载个人资料库'));
        }
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
