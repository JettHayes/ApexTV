import { cn } from '@/lib/cn';

/**
 * 媒体网格。两套功能原本各自复制了同一串 grid 类名。
 */
export default function MediaGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('apex-reading-grid', className)}>{children}</div>;
}
