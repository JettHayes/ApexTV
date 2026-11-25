'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { normalizeAppError, reportAppError, type AppErrorInfo } from '@/lib/app-error';
import ErrorNotice from './ErrorNotice';

export function GlobalErrorIndicator() {
  const [error, setError] = useState<AppErrorInfo | null>(null);
  useEffect(() => {
    const show = (cause: unknown, context: string) => {
      const info = reportAppError(cause, context);
      if (!info.cancelled) setError(info);
    };
    const custom = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      show(detail.error || detail.message, detail.context || '数据操作');
    };
    const runtime = (event: ErrorEvent) => {
      if (!event.message || /^(?:chrome|moz|edge)-extension:/i.test(event.filename || '')) return;
      show(event.error || { code: 'CLIENT_RUNTIME_ERROR', message: event.message }, '页面运行');
    };
    const rejected = (event: PromiseRejectionEvent) => show(event.reason, '异步操作');
    window.addEventListener('globalError', custom);
    window.addEventListener('error', runtime);
    window.addEventListener('unhandledrejection', rejected);
    return () => {
      window.removeEventListener('globalError', custom);
      window.removeEventListener('error', runtime);
      window.removeEventListener('unhandledrejection', rejected);
    };
  }, []);
  if (!error) return null;
  return <aside className='apex-global-error' aria-label='错误通知'>
    <button className='apex-error-dismiss' type='button' onClick={() => setError(null)} aria-label='关闭错误提示'><X size={18} aria-hidden /></button>
    <ErrorNotice error={error} context={error.context} />
  </aside>;
}

export function triggerGlobalError(error: unknown, context = '数据操作') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('globalError', { detail: { error: normalizeAppError(error, context), context } }));
}
