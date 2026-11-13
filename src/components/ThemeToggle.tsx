'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
    return () => {
      if (transitionTimer.current !== null) {
        clearTimeout(transitionTimer.current);
        delete document.documentElement.dataset.themeSwitching;
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = isDark ? '#091214' : '#edf2f1';
  }, [mounted, isDark]);

  const toggleTheme = () => {
    if (transitionTimer.current !== null) clearTimeout(transitionTimer.current);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.dataset.themeSwitching = 'true';
      transitionTimer.current = setTimeout(() => {
        delete document.documentElement.dataset.themeSwitching;
        transitionTimer.current = null;
      }, 320);
    }
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button type='button'
      onClick={toggleTheme}
      disabled={!mounted}
      className='ptv-theme-toggle flex h-11 w-11 items-center justify-center rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
      aria-label={isDark ? '切换为浅色' : '切换为深色'}
      aria-pressed={isDark}
      title={isDark ? '切换为浅色' : '切换为深色'}
    >
      <span key={isDark ? 'dark' : 'light'} className='ptv-theme-icon' aria-hidden='true'>
        {isDark ? <Sun className='h-6 w-6' /> : <Moon className='h-6 w-6' />}
      </span>
    </button>
  );
}
