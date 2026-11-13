'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const visitedPaths: string[] = [];
let navigationIndex = -1;
let listening = false;

function currentPath() {
  return window.location.pathname + window.location.search;
}

export function recordNavigation(path: string) {
  if (typeof window === 'undefined') return;
  if (!listening) {
    window.addEventListener('popstate', () => {
      const target = currentPath();
      const before = visitedPaths.lastIndexOf(target, navigationIndex - 1);
      const after = visitedPaths.indexOf(target, navigationIndex + 1);
      if (before >= 0) navigationIndex = before;
      else if (after >= 0) navigationIndex = after;
      else {
        visitedPaths.splice(0, visitedPaths.length, target);
        navigationIndex = 0;
      }
    });
    listening = true;
  }
  const target = currentPath() || path;
  if (visitedPaths[navigationIndex] === target) return;
  visitedPaths.splice(navigationIndex + 1);
  visitedPaths.push(target);
  navigationIndex = visitedPaths.length - 1;
}

export function BackButton() {
  const router = useRouter();
  const goBack = () => {
    let sameOrigin = false;
    try { sameOrigin = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { /* Direct entry falls back to home. */ }
    if ((navigationIndex > 0 || sameOrigin) && window.history.length > 1) router.back();
    else router.push('/');
  };
  return (
    <button type='button' onClick={goBack} className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors' aria-label='返回'>
      <ArrowLeft className='h-5 w-5' />
    </button>
  );
}
