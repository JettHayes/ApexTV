'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { WebLivePlayback, WebLiveSource } from '@/lib/web-live';

interface RecoveryOptions {
  source: WebLiveSource | null;
  phase: 'idle' | 'waiting' | 'retry';
  paused: boolean;
  onReady: () => void | Promise<void>;
  onOffline: (result: WebLivePlayback) => void;
  onError: (message: string, retryable: boolean, code?: string) => void;
  onExhausted: () => void;
}

const managedPlatforms = ['huya', 'bilibili', 'douyin', 'douyu'];
const retryDelays = [3000, 10000, 30000, 60000, 120000];
const pageVisible = () => document.visibilityState !== 'hidden';

/** 正常播放时不轮询；下播仅探测状态，网络错误退避重试。 */
export function useWebLiveRecovery(options: RecoveryOptions) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const attempts = useRef({ identity: '', count: 0 });
  const lastProbe = useRef(0);
  const sourceKey = options.source?.key;
  const platform = options.source?.platform;
  const roomId = options.source?.roomId;
  const identity = [sourceKey, platform, roomId].join(':');
  if (attempts.current.identity !== identity) {
    attempts.current = { identity, count: 0 };
    lastProbe.current = 0;
  }
  const reset = useCallback(() => {
    attempts.current.count = 0;
  }, []);

  useEffect(() => {
    if (
      !sourceKey ||
      !platform ||
      !roomId ||
      options.paused ||
      options.phase === 'idle'
    )
      return;
    const managed = managedPlatforms.includes(platform);
    if (!managed && platform !== 'custom') return;
    let disposed = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const sameSource = () =>
      callbacks.current.source?.key === sourceKey &&
      callbacks.current.source?.platform === platform &&
      callbacks.current.source?.roomId === roomId;
    const delay = () =>
      options.phase === 'waiting'
        ? 60000
        : retryDelays[Math.min(attempts.current.count, retryDelays.length - 1)];
    const schedule = (milliseconds: number) => {
      clearTimeout(timer);
      if (
        !disposed &&
        sameSource() &&
        !callbacks.current.paused &&
        pageVisible()
      )
        timer = setTimeout(() => {
          void check();
        }, milliseconds);
    };
    const check = async () => {
      if (
        disposed ||
        busy ||
        !sameSource() ||
        callbacks.current.paused ||
        !pageVisible()
      )
        return;
      if (platform === 'custom' && attempts.current.count >= 3) {
        callbacks.current.onExhausted();
        return;
      }
      busy = true;
      lastProbe.current = Date.now();
      if (options.phase === 'retry') attempts.current.count++;
      controller = new AbortController();
      const requestController = controller;
      const timeout = setTimeout(() => requestController.abort(), 40000);
      try {
        if (!managed) {
          await callbacks.current.onReady();
          return;
        }
        const query = new URLSearchParams({
          platform,
          roomId,
          sourceKey,
          probe: '1',
        });
        const response = await fetch('/api/web-live/stream?' + query, {
          signal: requestController.signal,
          cache: 'no-store',
        });
        const result = await response.json();
        if (
          disposed ||
          !sameSource() ||
          callbacks.current.paused ||
          requestController.signal.aborted
        )
          return;
        if (!response.ok) {
          if (response.status === 404) {
            await callbacks.current.onReady();
            return;
          }
          callbacks.current.onError(
            result.error || '暂时无法连接平台',
            result.retryable ?? response.status >= 500,
            result.code
          );
          return;
        }
        if (result.liveStatus === 'offline')
          callbacks.current.onOffline(result);
        else {
          if (options.phase === 'waiting') attempts.current.count++;
          await callbacks.current.onReady();
        }
      } catch {
        if (
          !disposed &&
          sameSource() &&
          !callbacks.current.paused &&
          pageVisible()
        )
          callbacks.current.onError(
            '平台连接暂时失败，稍后将自动重试',
            true,
            'NETWORK_ERROR'
          );
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!disposed) schedule(delay());
      }
    };
    const onVisible = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible')
        schedule(Math.max(0, 15000 - (Date.now() - lastProbe.current)));
      else controller?.abort();
    };
    schedule(delay());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sourceKey, platform, roomId, options.phase, options.paused]);

  return reset;
}
