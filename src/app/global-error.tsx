'use client';
import ErrorRecoveryView from '@/components/ErrorRecoveryView';
import '../styles/theme-tokens.css';
import '../styles/app-error.css';
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang='zh-CN' data-moontvplus=''><body><ErrorRecoveryView error={error} reset={reset} context='站点初始化' /></body></html>;
}
