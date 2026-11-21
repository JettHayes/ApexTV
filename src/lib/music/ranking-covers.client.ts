import type { MusicSource } from './types';

type CoverEntry = { cover: string; expiresAt: number };
type CoverJob = {
  key: string;
  source: MusicSource;
  boardId: string;
  listeners: Set<(cover: string) => void>;
  running: boolean;
};

const STORAGE_KEY = 'apex:ranking-covers:v1';
const cache = new Map<string, CoverEntry>();
const jobs = new Map<string, CoverJob>();
const queue: CoverJob[] = [];
let active = 0;
let restored = false;

function restore() {
  if (restored || typeof window === 'undefined') return;
  restored = true;
  try {
    const entries = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(entries)) return;
    for (const item of entries.slice(-128)) {
      if (!Array.isArray(item) || typeof item[0] !== 'string') continue;
      const entry = item[1];
      if (typeof entry?.cover === 'string' && entry.expiresAt > Date.now())
        cache.set(item[0], entry);
    }
  } catch {
    /* 私密模式或存储不可用时只使用内存缓存。 */
  }
}

function remember(key: string, cover: string) {
  cache.delete(key);
  cache.set(key, { cover, expiresAt: Date.now() + (cover ? 3600000 : 60000) });
  while (cache.size > 128) cache.delete(cache.keys().next().value as string);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(cache)));
  } catch {
    /* 可选缓存。 */
  }
}

function pump() {
  while (active < 2 && queue.length > 0) {
    const job = queue.shift()!;
    if (!job.listeners.size) {
      jobs.delete(job.key);
      continue;
    }
    active++;
    job.running = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const url =
      '/api/music/v2/discovery/board-cover?source=' +
      job.source +
      '&boardId=' +
      encodeURIComponent(job.boardId);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return '';
        const payload = await response.json();
        const cover = payload.data?.cover;
        return payload.success &&
          typeof cover === 'string' &&
          (/^https?:\/\//.test(cover) ||
            cover.startsWith('/api/music/proxy?url='))
          ? cover
          : '';
      })
      .catch(() => '')
      .then((cover) => {
        remember(job.key, cover);
        for (const listener of Array.from(job.listeners)) listener(cover);
      })
      .finally(() => {
        clearTimeout(timer);
        jobs.delete(job.key);
        active--;
        pump();
      });
  }
}

/** 只为可见卡片补图；相同榜单复用请求，离开视口后移除尚未执行的任务。 */
export function subscribeRankingCover(
  source: MusicSource,
  boardId: string,
  listener: (cover: string) => void
): () => void {
  restore();
  const key = source + ':' + boardId;
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    listener(entry.cover);
    return () => {};
  }

  let job = jobs.get(key);
  if (!job) {
    job = { key, source, boardId, listeners: new Set(), running: false };
    jobs.set(key, job);
    queue.push(job);
  }
  job.listeners.add(listener);
  pump();
  const current = job;
  return () => {
    current.listeners.delete(listener);
    if (!current.running && !current.listeners.size) {
      const index = queue.indexOf(current);
      if (index >= 0) queue.splice(index, 1);
      jobs.delete(key);
    }
  };
}
