import { BookmarkCheck, BookmarkPlus } from 'lucide-react';

import { cn } from '@/lib/cn';

import { SHELF_CHIP } from './library';
import ShelfToggleButton from './ShelfToggleButton';

/**
 * 封面右下角的书架开关，书墙（推荐页）与搜索结果共用。
 * 底色跟着状态走：未收藏采用媒体深色底与逆色图标，已收藏采用品牌按钮色，具体见 SHELF_CHIP 的注释。
 */
export default function ShelfChipButton({
  active,
  onClick,
  className,
}: {
  active: boolean;
  onClick: () => void | Promise<void>;
  className?: string;
}) {
  return (
    <ShelfToggleButton
      active={active}
      aria-label={active ? '移出书架' : '加入书架'}
      onClick={onClick}
      className={cn(
        SHELF_CHIP,
        active
          ? 'bg-library-action text-library-action-ink hover:bg-[var(--ptv-action-hover)] hover:text-library-action-ink dark:text-library-action-ink dark:hover:text-library-action-ink'
          : 'bg-[var(--ptv-cover-control-bg)] hover:bg-[var(--ptv-media-panel)] hover:text-library-chip dark:text-library-chip dark:hover:text-library-chip',
        className
      )}
    >
      {active ? (
        <BookmarkCheck className='h-4 w-4' />
      ) : (
        <BookmarkPlus className='h-4 w-4' />
      )}
    </ShelfToggleButton>
  );
}
