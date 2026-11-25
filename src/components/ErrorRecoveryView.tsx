'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import ErrorNotice from './ErrorNotice';
import { reportAppError } from '@/lib/app-error';

export default function ErrorRecoveryView({ error, reset, context = '页面加载' }: { error: unknown; reset?: () => void; context?: string }) {
  useEffect(() => { reportAppError(error, context); }, [error, context]);
  return <main className='apex-error-page'><div className='apex-error-page-inner'>
    <span className='apex-error-brand'>Apex TV</span>
    <h1>暂时无法完成此操作</h1>
    <ErrorNotice error={error} context={context} onRetry={reset} />
    <Link href='/' className='apex-error-home'><Home size={17} aria-hidden />返回首页</Link>
  </div></main>;
}
