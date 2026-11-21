'use client';

import { useEffect, useRef } from 'react';

import type { WebLivePlayback, WebLiveSource } from '@/lib/web-live';

/** 后台更新直播状态，不清空当前播放器；新节目 ID 到达后才更新 iframe。 */
export function useYouTubeLiveRefresh(
  source: WebLiveSource | null,
  paused: boolean,
  onPlayback: (result: WebLivePlayback) => void
) {
  const callbackRef = useRef(onPlayback);
  const pausedRef = useRef(paused);
  callbackRef.current = onPlayback;
  pausedRef.current = paused;

  const sourceKey = source?.key;
  const platform = source?.platform;
  const roomId = source?.roomId;

  useEffect(() => {
    if (!sourceKey || !roomId || platform !== 'youtube') return;
    let disposed = false;
    let busy = false;
    let lastRequest = 0;
    let controller: AbortController | undefined;

    const refresh = async () => {
      if (
        disposed ||
        busy ||
        pausedRef.current ||
        document.visibilityState === 'hidden' ||
        Date.now() - lastRequest < 15000
      )
        return;
      busy = true;
      lastRequest = Date.now();
      controller = new AbortController();
      const requestController = controller;
      const timeout = setTimeout(() => requestController.abort(), 35000);
      try {
        const query = new URLSearchParams({
          platform: 'youtube',
          roomId,
          sourceKey,
        });
        const response = await fetch('/api/web-live/stream?' + query, {
          signal: requestController.signal,
          cache: 'no-store',
        });
        if (!response.ok) return;
        const result = (await response.json()) as WebLivePlayback;
        if (
          !disposed &&
          !requestController.signal.aborted &&
          !pausedRef.current &&
          result.kind === 'embed'
        )
          callbackRef.current(result);
      } catch {
        /* 临时网络错误不销毁现有画面，下一轮继续检查。 */
      } finally {
        clearTimeout(timeout);
        busy = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = setInterval(() => {
      void refresh();
    }, 60000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sourceKey, platform, roomId]);
}
