'use client';

import Script from 'next/script';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { useTheme } from './ThemeProvider';

type WidgetSize = 'compact' | 'flexible';
type TurnstileAPI = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme: 'light' | 'dark';
    size: WidgetSize;
    appearance: 'always';
    callback: (token: string) => void;
    'error-callback': (code: string) => void;
    'expired-callback': () => void;
    'timeout-callback': () => void;
  }) => string | undefined;
  remove: (widgetId: string) => void;
};

export type TurnstileWidgetHandle = { reset: () => void };

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, {
  siteKey: string;
  onToken: (token: string | null) => void;
}>(function TurnstileWidget({ siteKey, onToken }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenCallbackRef = useRef(onToken);
  tokenCallbackRef.current = onToken;
  const { resolvedTheme } = useTheme();
  const [scriptReady, setScriptReady] = useState(false);
  const [size, setSize] = useState<WidgetSize | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      tokenCallbackRef.current(null);
      setResetKey((value) => value + 1);
    },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setSize(container.clientWidth < 300 ? 'compact' : 'flexible');
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || scriptReady) return;
    const timer = window.setTimeout(() => {
      setError('人机验证加载超时，请检查网络或浏览器拦截设置后重试。');
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [siteKey, scriptReady]);

  useEffect(() => {
    tokenCallbackRef.current(null);
    if (!scriptReady || !siteKey || !size || !containerRef.current) return;

    const api = (window as Window & { turnstile?: TurnstileAPI }).turnstile;
    if (!api) {
      setError('人机验证初始化失败，请重新加载。');
      return;
    }

    let cancelled = false;
    let widgetId: string | undefined;
    setStatus('loading');
    setError(null);
    // next/script 的 onReady 已确认脚本加载完成，直接渲染；
    // 异步加载的 Turnstile 脚本不能再调用 turnstile.ready()。
    try {
      widgetId = api.render(containerRef.current, {
        sitekey: siteKey,
        theme: resolvedTheme,
        size,
        appearance: 'always',
        callback: (token) => {
          if (cancelled) return;
          tokenCallbackRef.current(token);
          setError(null);
          setStatus('verified');
        },
        'error-callback': () => {
          if (cancelled) return;
          tokenCallbackRef.current(null);
          setError('人机验证未能完成，请重试；持续失败时请检查站点域名与验证配置。');
        },
        'expired-callback': () => {
          if (cancelled) return;
          tokenCallbackRef.current(null);
          setError('验证已过期，请重新验证。');
        },
        'timeout-callback': () => {
          if (cancelled) return;
          tokenCallbackRef.current(null);
          setError('验证超时，请重试。');
        },
      });
      if (widgetId === undefined) {
        setError('人机验证初始化失败，请重试。');
      } else {
        setStatus((current) => current === 'verified' ? current : 'ready');
      }
    } catch {
      setError('人机验证初始化失败，请重试。');
    }

    return () => {
      cancelled = true;
      if (widgetId !== undefined) api.remove(widgetId);
    };
  }, [scriptReady, siteKey, size, resolvedTheme, resetKey]);

  return (
    <section className='ptv-turnstile' aria-label='人机验证'>
      {siteKey && (
        <Script
          id='apex-turnstile-api'
          src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
          strategy='afterInteractive'
          onReady={() => setScriptReady(true)}
          onError={() => setError('人机验证脚本加载失败，请检查网络或浏览器拦截设置。')}
        />
      )}
      <div className='ptv-turnstile-caption' role='status' aria-live='polite'>
        <span>安全验证</span>
        <span>{status === 'verified' && !error ? '验证通过' : '请完成人机验证'}</span>
      </div>
      <div className='ptv-turnstile-widget' ref={containerRef} />
      {!siteKey ? (
        <p className='ptv-turnstile-error' role='alert'>已开启人机验证，但未配置站点公钥，请联系管理员。</p>
      ) : error ? (
        <div className='ptv-turnstile-error' role='alert'>
          <p>{error}</p>
          <button type='button' onClick={() => {
            if (scriptReady && (window as Window & { turnstile?: TurnstileAPI }).turnstile) {
              tokenCallbackRef.current(null);
              setResetKey((value) => value + 1);
            } else {
              window.location.reload();
            }
          }}>重新加载验证</button>
        </div>
      ) : status === 'loading' ? (
        <p className='ptv-turnstile-hint' role='status'>正在加载验证组件…</p>
      ) : null}
    </section>
  );
});

export default TurnstileWidget;
