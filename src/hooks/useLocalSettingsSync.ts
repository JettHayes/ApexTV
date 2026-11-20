'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  applyLocalSettingsSnapshot,
  LOCAL_SETTINGS_CHANGED,
  snapshotLocalSettings,
} from '@/lib/local-settings';
import {
  LOCAL_SETTINGS_SYNC_LAST_PULL_KEY,
  validateLocalSettingsPayload,
} from '@/lib/local-settings-sync';

const automaticPulls = new Map<string, Promise<void>>();
const supportedStorage = new Set([
  'd1',
  'postgres',
  'turso',
  'redis',
  'upstash',
  'kvrocks',
]);

async function cloudRequest(init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/local-settings-sync', {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('云同步失败，请检查登录状态和网络后重试');
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function useLocalSettingsSync(open: boolean) {
  const [mode, setMode] = useState<'off' | 'manual' | 'auto'>('off');
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const usernameRef = useRef('');
  const editedDuringPull = useRef(false);
  const openedSnapshot = useRef<string | null>(null);
  const lastOpen = useRef(false);

  const pull = useCallback(async (manual: boolean) => {
    if (manual) setBusy(true);
    editedDuringPull.current = false;
    try {
      const result = await cloudRequest();
      if (!result.payload) {
        if (manual) {
          setMessage('云端暂无备份');
          setError(false);
        }
        return;
      }
      const validated = validateLocalSettingsPayload(result.payload);
      if ('error' in validated)
        throw new Error('云端备份格式无效，本机设置保持不变');
      const key = `${LOCAL_SETTINGS_SYNC_LAST_PULL_KEY}:${usernameRef.current}`;
      const timestamp = Number(result.updatedAt ?? validated.payload.updatedAt);
      if (!Number.isFinite(timestamp)) throw new Error('云端备份时间无效');
      if (
        !manual &&
        (editedDuringPull.current ||
          timestamp <= Number(localStorage.getItem(key) || 0))
      )
        return;
      applyLocalSettingsSnapshot(validated.payload.data);
      localStorage.setItem(key, String(timestamp));
      if (manual) {
        setMessage('已恢复云端设置；目录权限保留在本机');
        setError(false);
      }
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : '云同步失败，本机设置保持不变'
      );
      setError(true);
    } finally {
      if (manual) setBusy(false);
    }
  }, []);

  const push = useCallback(async () => {
    setBusy(true);
    try {
      const payload = {
        version: 1,
        data: snapshotLocalSettings(),
        updatedAt: Date.now(),
      };
      const result = await cloudRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      localStorage.setItem(
        `${LOCAL_SETTINGS_SYNC_LAST_PULL_KEY}:${usernameRef.current}`,
        String(result.updatedAt ?? payload.updatedAt)
      );
      setMessage(
        result.changed === false ? '云端已是最新设置' : '已备份到云端'
      );
      setError(false);
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : '云同步失败，本机设置已保留'
      );
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const config =
      (window as Window & { RUNTIME_CONFIG?: Record<string, unknown> })
        .RUNTIME_CONFIG ?? {};
    const configured = config.LOCAL_SETTINGS_SYNC_MODE;
    const nextMode =
      configured === 'manual' || configured === 'auto' ? configured : 'off';
    const username = getAuthInfoFromBrowserCookie()?.username || '';
    usernameRef.current = username;
    const enabled =
      Boolean(username) &&
      supportedStorage.has(String(config.STORAGE_TYPE)) &&
      nextMode !== 'off';
    setMode(nextMode);
    setAvailable(enabled);
    const changed = () => {
      editedDuringPull.current = true;
    };
    window.addEventListener(LOCAL_SETTINGS_CHANGED, changed);
    if (enabled && nextMode === 'auto') {
      if (!automaticPulls.has(username))
        automaticPulls.set(username, pull(false));
    }
    return () => window.removeEventListener(LOCAL_SETTINGS_CHANGED, changed);
  }, [pull]);

  useEffect(() => {
    try {
      if (open && !lastOpen.current)
        openedSnapshot.current = JSON.stringify(snapshotLocalSettings());
      if (
        !open &&
        lastOpen.current &&
        available &&
        mode === 'auto' &&
        !busy &&
        openedSnapshot.current !== null
      ) {
        const snapshot = JSON.stringify(snapshotLocalSettings());
        if (openedSnapshot.current !== snapshot) void push();
      }
    } catch {
      openedSnapshot.current = null;
      setMessage('当前浏览器无法访问本地存储，请检查隐私设置或可用空间');
      setError(true);
    }
    lastOpen.current = open;
  }, [open, available, mode, busy, push]);

  return {
    mode,
    available,
    busy,
    message,
    error,
    push,
    pull: () => pull(true),
  };
}
