'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { normalizeAppError } from '@/lib/app-error';

export default function ErrorNotice({ error, context = '操作', onRetry }: { error: unknown; context?: string; onRetry?: () => void }) {
  const info = normalizeAppError(error, context);
  if (!error || info.cancelled) return null;
  return <section role='alert' className='apex-error-notice'>
    <AlertCircle size={19} aria-hidden />
    <div className='apex-error-copy'>
      <strong>{info.context}失败</strong>
      <p>{info.reason}</p>
      <p className='apex-error-hint'>{info.hint}</p>
      <details><summary>错误代码：{info.code}{info.status ? ' · HTTP ' + info.status : ''}{info.upstreamStatus ? ' · 上游 HTTP ' + info.upstreamStatus : ''}{info.originalCode ? ' · 原始代码 ' + info.originalCode : ''}</summary>
        <p>{info.details || '当前没有更多诊断信息。'}</p>
      </details>
    </div>
    {onRetry && <button type='button' onClick={onRetry}><RefreshCw size={16} aria-hidden />重试</button>}
  </section>;
}
