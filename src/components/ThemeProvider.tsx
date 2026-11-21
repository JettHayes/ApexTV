'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Theme = 'light' | 'dark';
type ThemeContextValue = {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('light');

  const setTheme = useCallback((theme: Theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', theme === 'dark' ? '#101619' : '#f3f6f6'
    );
    setResolvedTheme(theme);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    let frame = 0;

    const syncSystemTheme = () => {
      const theme = media.matches ? 'dark' : 'light';
      if (root.classList.contains('dark') === media.matches) {
        setTheme(theme);
        return;
      }
      root.dataset.themeSyncing = 'true';
      setTheme(theme);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          delete root.dataset.themeSyncing;
        });
      });
    };

    syncSystemTheme();
    if (media.addEventListener) media.addEventListener('change', syncSystemTheme);
    else media.addListener(syncSystemTheme);

    return () => {
      if (media.removeEventListener) media.removeEventListener('change', syncSystemTheme);
      else media.removeListener(syncSystemTheme);
      window.cancelAnimationFrame(frame);
      delete root.dataset.themeSyncing;
    };
  }, [setTheme]);

  const value = useMemo(() => ({ resolvedTheme, setTheme }), [resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
