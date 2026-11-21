'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface TwitchInstance {
  addEventListener(event: string, callback: () => void): void;
  destroy(): void;
  play(): void;
}
interface TwitchSdk {
  Player: {
    new (
      id: string,
      options: {
        width: string;
        height: string;
        channel: string;
        parent: string[];
        autoplay: boolean;
      }
    ): TwitchInstance;
    READY: string;
    ONLINE: string;
    OFFLINE: string;
    ENDED: string;
    PLAYING: string;
    PLAYBACK_BLOCKED: string;
  };
}
type TwitchWindow = Window & { Twitch?: TwitchSdk };
let sdkPromise: Promise<TwitchSdk> | null = null;

function loadSdk(): Promise<TwitchSdk> {
  const loaded = (window as TwitchWindow).Twitch;
  if (loaded?.Player) return Promise.resolve(loaded);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<TwitchSdk>((resolve, reject) => {
    const script = document.createElement('script');
    const cleanup = () => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(new Error('Twitch 播放器组件加载失败'));
    };
    const timer = setTimeout(fail, 10000);
    script.src = 'https://player.twitch.tv/js/embed/v1.js';
    script.async = true;
    script.onload = () => {
      const sdk = (window as TwitchWindow).Twitch;
      if (!sdk?.Player) {
        fail();
        return;
      }
      cleanup();
      resolve(sdk);
    };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

export default function TwitchLivePlayer({
  channel,
  embedUrl,
  title,
  onStatus,
}: {
  channel: string;
  embedUrl: string;
  title: string;
  onStatus: (status: 'live' | 'offline' | 'unknown') => void;
}) {
  const id = 'apex-twitch-' + useId().replace(/:/g, '');
  const playerRef = useRef<TwitchInstance | null>(null);
  const callbackRef = useRef(onStatus);
  callbackRef.current = onStatus;
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFallback(false);
    setReady(false);
    setBlocked(false);
    let player: TwitchInstance | null = null;
    void loadSdk()
      .then((sdk) => {
        if (cancelled) return;
        player = new sdk.Player(id, {
          width: '100%',
          height: '100%',
          channel,
          parent: [window.location.hostname],
          autoplay: true,
        });
        playerRef.current = player;
        const listen = (event: string, callback: () => void) =>
          player!.addEventListener(event, () => {
            if (!cancelled) callback();
          });
        listen(sdk.Player.READY, () => setReady(true));
        listen(sdk.Player.ONLINE, () => callbackRef.current('live'));
        listen(sdk.Player.OFFLINE, () => callbackRef.current('offline'));
        listen(sdk.Player.ENDED, () => callbackRef.current('offline'));
        listen(sdk.Player.PLAYING, () => {
          setBlocked(false);
          callbackRef.current('live');
        });
        listen(sdk.Player.PLAYBACK_BLOCKED, () => {
          setReady(true);
          setBlocked(true);
        });
      })
      .catch(() => {
        if (!cancelled) {
          player?.destroy();
          player = null;
          playerRef.current = null;
          setFallback(true);
          callbackRef.current('unknown');
        }
      });
    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
    };
  }, [channel, embedUrl, id]);

  return (
    <div className='relative h-full w-full bg-black'>
      <div id={id} className='h-full w-full' />
      {fallback ? (
        <iframe
          src={embedUrl}
          title={title}
          className='absolute inset-0 h-full w-full border-0'
          allow='autoplay; encrypted-media; fullscreen; picture-in-picture'
          allowFullScreen
        />
      ) : (
        !ready && (
          <span className='pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white'>
            正在连接 Twitch 播放器…
          </span>
        )
      )}
      {blocked && !fallback && (
        <button
          type='button'
          className='ptv-twitch-play absolute bottom-4 left-4 rounded-lg px-4 py-3 text-sm'
          onClick={() => playerRef.current?.play()}
        >
          点击开始播放
        </button>
      )}
    </div>
  );
}
