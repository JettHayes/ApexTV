/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps */

'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useId, useRef, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  const setThemeColor = (theme?: string) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme === 'dark' ? '#091214' : '#edf2f1';
      document.head.appendChild(meta);
    } else {
      meta.setAttribute('content', theme === 'dark' ? '#091214' : '#edf2f1');
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  // 监听主题变化和路由变化，确保主题色始终同步
  useEffect(() => {
    if (mounted) {
      setThemeColor(resolvedTheme);
    }
  }, [mounted, resolvedTheme, pathname]);

  if (!mounted) {
    // 渲染一个占位符以避免布局偏移
    return <div className='h-11 w-11' />;
  }

  const chooseTheme = (nextTheme: 'system' | 'light' | 'dark') => {
    // 检查浏览器是否支持 View Transitions API
    const targetTheme = nextTheme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : nextTheme;
    setThemeColor(targetTheme);
    setOpen(false);
    buttonRef.current?.focus();
    if (!(document as any).startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('video')) {
      setTheme(nextTheme);
      return;
    }

    (document as any).startViewTransition(() => {
      setTheme(nextTheme);
    });
  };

  return (
    <div ref={containerRef} className='ptv-theme-control relative' onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } }}>
    <button ref={buttonRef} type='button'
      onClick={() => setOpen((value) => !value)}
      className='flex h-11 w-11 items-center justify-center rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
      aria-label='选择外观主题'
      aria-expanded={open}
      aria-controls={panelId}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className='w-full h-full' />
      ) : (
        <Moon className='w-full h-full' />
      )}
    </button>
    {open && <div id={panelId} role='group' aria-label='外观主题' className='ptv-theme-options'>
      {([{ value: 'system', label: '跟随系统', icon: Monitor }, { value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }] as const).map(({ value, label, icon: Icon }) => (
        <button key={value} type='button' aria-pressed={theme === value} onClick={() => chooseTheme(value)}><Icon className='h-4 w-4' /><span>{label}</span>{theme === value && <Check className='ml-auto h-4 w-4' />}</button>
      ))}
    </div>}
    </div>
  );
}
