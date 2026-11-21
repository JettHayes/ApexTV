'use client';

import { useEffect, useRef } from 'react';

export default function WebLivePlayer({
  url,
  type,
  onFailure,
  onPlaying,
  onBuffering,
}: {
  url: string;
  type: 'hls' | 'flv';
  onFailure: (message: string, retryable: boolean, code?: string) => void;
  onPlaying?: () => void;
  onBuffering?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef(onFailure);
  failureRef.current = onFailure;
  const playingRef = useRef(onPlaying);
  playingRef.current = onPlaying;
  const bufferingRef = useRef(onBuffering);
  bufferingRef.current = onBuffering;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) return;
    let cancelled = false;
    let reported = false;
    let art: any = null;
    let destroyStream = () => {};
    let video: HTMLVideoElement | null = null;
    const fail = (message: string, retryable: boolean, code?: string) => {
      if (!cancelled && !reported) {
        reported = true;
        failureRef.current(message, retryable, code);
      }
    };

    const loadStream = async (element: HTMLVideoElement, streamUrl: string) => {
      video = element;
      element.onplaying = () => {
        if (!cancelled) playingRef.current?.();
      };
      const stopStablePlayback = () => {
        if (!cancelled) bufferingRef.current?.();
      };
      element.onwaiting = stopStablePlayback;
      element.onstalled = stopStablePlayback;
      element.onpause = stopStablePlayback;
      element.onended = () =>
        fail('直播已结束，正在检查房间状态', true, 'PLAYBACK_ENDED');
      try {
        if (
          type === 'hls' &&
          element.canPlayType('application/vnd.apple.mpegurl')
        ) {
          element.src = streamUrl;
          element.onerror = () => fail('直播流播放失败', true);
        } else if (type === 'hls') {
          const Hls = (await import('hls.js')).default;
          if (cancelled) return;
          if (!Hls.isSupported()) {
            fail('当前浏览器不支持 HLS 播放', false);
            return;
          }
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          destroyStream = () => hls.destroy();
          let mediaRecoveries = 0;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (
              data.type === Hls.ErrorTypes.MEDIA_ERROR &&
              mediaRecoveries++ < 1
            ) {
              hls.recoverMediaError();
            } else {
              const status = Number(data.response?.code);
              fail(
                status === 401 || status === 403
                  ? '播放地址已失效或访问被拒绝'
                  : '直播流连接失败',
                true,
                status === 401 || status === 403
                  ? 'HTTP_EXPIRED'
                  : 'NETWORK_ERROR'
              );
            }
          });
          hls.loadSource(streamUrl);
          hls.attachMedia(element);
        } else {
          const flv = (await import('flv.js')).default;
          if (cancelled) return;
          if (!flv.isSupported()) {
            fail('当前浏览器不支持 FLV，请尝试 HLS 线路或其他设备', false);
            return;
          }
          const player = flv.createPlayer({
            type: 'flv',
            url: streamUrl,
            isLive: true,
          });
          destroyStream = () => {
            player.unload();
            player.detachMediaElement();
            player.destroy();
          };
          player.on(flv.Events.ERROR, () => fail('直播流连接失败', true));
          player.attachMediaElement(element);
          player.load();
        }
        element.play().catch(() => {});
      } catch {
        fail('播放器初始化失败', true);
      }
    };

    const start = async () => {
      try {
        const Artplayer = (await import('artplayer')).default;
        if (cancelled) return;
        art = new Artplayer({
          container,
          url,
          type: type === 'hls' ? 'm3u8' : 'flv',
          isLive: true,
          autoplay: true,
          fullscreen: true,
          fullscreenWeb: true,
          volume: 0.7,
          muted: false,
          setting: true,
          playsInline: true,
          customType: { m3u8: loadStream, flv: loadStream },
          icons: {
            loading:
              '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 100 100"><circle cx="50" cy="50" fill="none" stroke="currentColor" stroke-width="4" r="35" stroke-dasharray="164.93361431346415 56.97787143782138"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" values="0 50 50;360 50 50" keyTimes="0;1"/></circle></svg>',
          },
        });
      } catch {
        fail('播放器初始化失败', true);
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (video) {
        (video as HTMLVideoElement).onerror = null;
        (video as HTMLVideoElement).onplaying = null;
        (video as HTMLVideoElement).onended = null;
        (video as HTMLVideoElement).onwaiting = null;
        (video as HTMLVideoElement).onstalled = null;
        (video as HTMLVideoElement).onpause = null;
      }
      try {
        destroyStream();
      } finally {
        art?.destroy();
      }
    };
  }, [url, type]);

  return <div ref={containerRef} className='h-full w-full bg-black' />;
}
