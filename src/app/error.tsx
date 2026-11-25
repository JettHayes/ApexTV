'use client';
import ErrorRecoveryView from '@/components/ErrorRecoveryView';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorRecoveryView error={error} reset={reset} />;
}
