'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { smoothScrollBehavior } from '@/lib/motion';

interface VirtualScrollableRowProps {
  children: React.ReactNode[];
  maxVisible?: number; // 最大可见数量
  className?: string; // 额外的 CSS 类名
}

export default function VirtualScrollableRow({
  children,
  maxVisible = 30, // 默认最多显示 30 个项目
  className = '',
}: VirtualScrollableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: maxVisible });

  const strideRef = useRef(208);
  const [itemStride, setItemStride] = useState(208);

  // Scroll bookkeeping follows the measured card width, including responsive layouts.
  const checkScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft + clientWidth < scrollWidth - 10;

    setShowLeftScroll(canScrollLeft);
    setShowRightScroll(canScrollRight);

    // 计算可见范围（基于滚动位置）
    const itemWidth = strideRef.current;
    const scrolledItems = Math.floor(scrollLeft / itemWidth);
    const visibleItems = Math.ceil(clientWidth / itemWidth);

    // 扩展渲染范围（当前可见 + 前后缓冲）
    const bufferSize = 5;
    const newStart = Math.max(0, scrolledItems - bufferSize);
    const newEnd = Math.min(children.length, scrolledItems + visibleItems + bufferSize);

    setVisibleRange((previous) => previous.start === newStart && previous.end === newEnd ? previous : { start: newStart, end: newEnd });
  }, [children.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const card = Array.from(container.children).find((child) => !child.hasAttribute('data-virtual-spacer')) as HTMLElement | undefined;
      if (card) {
        const gap = Number.parseFloat(window.getComputedStyle(container).columnGap) || 8;
        const stride = card.getBoundingClientRect().width + gap;
        if (stride > 0 && Math.abs(stride - strideRef.current) > 0.5) {
          strideRef.current = stride;
          setItemStride(stride);
        }
      }
      checkScroll();
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container);
    container.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', measure);
    };
  }, [checkScroll]);

  const scrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: -400,
        behavior: smoothScrollBehavior(),
      });
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: 400,
        behavior: smoothScrollBehavior(),
      });
    }
  };

  // 渲染可见项目
  const visibleChildren = children.slice(visibleRange.start, visibleRange.end);

  return (
    <div className="relative group/row">
      {/* 左侧滚动按钮（常驻挂载，不可滚动时隐藏） */}
      <button
        onClick={scrollLeft}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-[600] bg-white/90 dark:bg-gray-800/90 p-2 rounded-full shadow-lg opacity-0 transition-opacity hover:bg-white dark:hover:bg-gray-700 ${
          showLeftScroll ? 'group-hover/row:opacity-100' : 'pointer-events-none'
        }`}
        aria-label="向左滚动"
        aria-hidden={!showLeftScroll}
        tabIndex={showLeftScroll ? undefined : -1}
      >
        <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </button>

      {/* 滚动容器 */}
      <div
        ref={containerRef}
        className={`flex gap-2 overflow-x-auto scrollbar-hide ${className}`}
        style={{ paddingTop: '20px', paddingBottom: '20px', marginTop: '-20px', marginBottom: '-20px' }}
      >
        {/* 左侧占位符（用于保持滚动位置） */}
        {visibleRange.start > 0 && (
          <div data-virtual-spacer style={{ minWidth: Math.max(0, visibleRange.start * itemStride - 8), flexShrink: 0 }} />
        )}

        {/* 渲染可见项目 */}
        {visibleChildren}

        {/* 右侧占位符 */}
        {visibleRange.end < children.length && (
          <div data-virtual-spacer style={{ minWidth: Math.max(0, (children.length - visibleRange.end) * itemStride - 8), flexShrink: 0 }} />
        )}
      </div>

      {/* 右侧滚动按钮（常驻挂载，不可滚动时隐藏） */}
      <button
        onClick={scrollRight}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-[600] bg-white/90 dark:bg-gray-800/90 p-2 rounded-full shadow-lg opacity-0 transition-opacity hover:bg-white dark:hover:bg-gray-700 ${
          showRightScroll ? 'group-hover/row:opacity-100' : 'pointer-events-none'
        }`}
        aria-label="向右滚动"
        aria-hidden={!showRightScroll}
        tabIndex={showRightScroll ? undefined : -1}
      >
        <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </button>
    </div>
  );
}
