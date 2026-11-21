'use client';

import { Moon, Sun } from 'lucide-react';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { useTheme } from './ThemeProvider';

type ThemeTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
};

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const transitionRef = useRef<ThemeTransition | null>(null);
  const frameRef = useRef<number | null>(null);
  const ownsSwitch = useRef(false);
  const isDark = mounted && resolvedTheme === 'dark';

  const finishSwitch = useCallback(() => {
    transitionRef.current?.skipTransition();
    transitionRef.current = null;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (!ownsSwitch.current) return;
    ownsSwitch.current = false;
    const root = document.documentElement;
    delete root.dataset.themeSwitching;
    root.style.removeProperty('--ptv-theme-origin');
    root.style.removeProperty('--ptv-theme-radius');
  }, []);

  useEffect(() => {
    setMounted(true);
    const handleVisibility = () => {
      if (document.hidden) finishSwitch();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      finishSwitch();
    };
  }, [finishSwitch]);

  const toggleTheme = async (event: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    if (root.dataset.themeSwitching || root.dataset.themeSyncing) return;
    const nextTheme = isDark ? 'light' : 'dark';
    const doc = document as TransitionDocument;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.detail ? event.clientX : rect.left + rect.width / 2;
    const y = event.detail ? event.clientY : rect.top + rect.height / 2;
    const radius = Math.ceil(Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ));
    let applied = false;
    const applyTheme = () => {
      if (applied) return;
      flushSync(() => setTheme(nextTheme));
      applied = true;
    };
    const switchWithoutAnimation = () => {
      try {
        applyTheme();
      } finally {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = window.requestAnimationFrame(finishSwitch);
        });
      }
    };

    ownsSwitch.current = true;
    root.dataset.themeSwitching = 'true';
    if (!doc.startViewTransition || document.hidden ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      switchWithoutAnimation();
      return;
    }

    root.style.setProperty('--ptv-theme-origin', `${x}px ${y}px`);
    root.style.setProperty('--ptv-theme-radius', `${radius}px`);
    let transition: ThemeTransition;
    try {
      transition = doc.startViewTransition(applyTheme);
    } catch {
      switchWithoutAnimation();
      return;
    }
    transitionRef.current = transition;
    // 后台切换或浏览器跳过动画时 ready 可以拒绝，主题更新仍然有效。
    void transition.ready.catch(() => {});
    try {
      await transition.finished;
    } catch {
      applyTheme();
    } finally {
      if (transitionRef.current === transition) finishSwitch();
    }
  };

  return (
    <button type='button'
      onClick={toggleTheme}
      disabled={!mounted}
      className={`ptv-theme-toggle flex h-11 w-11 items-center justify-center rounded-full p-2 text-gray-600 transition-[color,background-color,transform] hover:bg-gray-200/50 active:scale-95 dark:text-gray-300 dark:hover:bg-gray-700/50 ${className}`}
      aria-label={isDark ? '切换为浅色' : '切换为深色'}
      aria-pressed={isDark}
      title={isDark ? '切换为浅色' : '切换为深色'}
    >
      <span className='ptv-theme-icon' aria-hidden='true'>
        {isDark ? <Sun className='h-6 w-6' /> : <Moon className='h-6 w-6' />}
      </span>
    </button>
  );
}
