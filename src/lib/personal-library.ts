import type { Favorite, PlayRecord } from './db.client';

export const WATCH_STATES = {
  later: '稍后观看',
  watching: '正在看',
  completed: '已看完',
  paused: '暂时搁置',
} as const;
export type WatchState = keyof typeof WATCH_STATES;
export interface LibraryVideo {
  source: string;
  id: string;
  title: string;
  cover: string;
  year: string;
  source_name: string;
  total_episodes: number;
  search_title?: string;
  origin?: 'vod' | 'live';
  is_anime?: boolean;
  is_duanju?: boolean;
}
export interface LibraryEntry extends LibraryVideo {
  status?: WatchState;
  lists: string[];
  updatedAt: number;
}
export interface LibraryList {
  id: string;
  name: string;
  updatedAt: number;
}
export interface PersonalLibrary {
  entries: Record<string, LibraryEntry>;
  lists: LibraryList[];
}
export const emptyPersonalLibrary = (): PersonalLibrary => ({
  entries: {},
  lists: [],
});
export const libraryKey = (video: Pick<LibraryVideo, 'source' | 'id'>) =>
  video.source + '+' + video.id;

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
export function normalizeLibraryEntry(raw: unknown): LibraryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const source = text(v.source, 180),
    id = text(v.id, 2048),
    title = text(v.title, 300);
  if (!source || source.includes('+') || !id || !title) return null;
  const status =
    typeof v.status === 'string' && Object.hasOwn(WATCH_STATES, v.status)
      ? (v.status as WatchState)
      : undefined;
  return {
    source,
    id,
    title,
    cover: text(v.cover, 4096),
    year: text(v.year, 20),
    source_name: text(v.source_name, 180),
    total_episodes: Math.max(
      1,
      Math.min(100000, Number(v.total_episodes) || 1)
    ),
    search_title: text(v.search_title, 300),
    origin: v.origin === 'live' ? 'live' : 'vod',
    is_anime: v.is_anime === true,
    is_duanju: v.is_duanju === true,
    status,
    lists: Array.isArray(v.lists)
      ? Array.from(
          new Set(
            v.lists.filter(
              (id): id is string =>
                typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id)
            )
          )
        ).slice(0, 100)
      : [],
    updatedAt: Number.isFinite(v.updatedAt) ? Number(v.updatedAt) : 0,
  };
}
export function normalizeLibraryList(raw: unknown): LibraryList | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>,
    id = text(v.id, 80),
    name = text(v.name, 40);
  return /^[a-zA-Z0-9-]{1,80}$/.test(id) && name
    ? { id, name, updatedAt: Number(v.updatedAt) || 0 }
    : null;
}
export function videoFromRecord(
  key: string,
  value: Favorite | PlayRecord
): LibraryVideo | null {
  const index = key.indexOf('+');
  if (index < 1) return null;
  return normalizeLibraryEntry({
    ...value,
    source: key.slice(0, index),
    id: key.slice(index + 1),
  });
}
export function libraryPlaybackUrl(
  video: LibraryVideo,
  record?: PlayRecord
): string {
  const params = new URLSearchParams({ title: video.title });
  if (video.source !== 'discovery') {
    params.set('source', video.source);
    params.set('id', video.id);
  }
  if (video.origin === 'live') {
    params.set('source', video.source.replace(/^live_/, ''));
    params.set('id', video.id.replace(/^live_/, ''));
    return '/live?' + params.toString();
  }
  if (video.year) params.set('year', video.year);
  if (video.search_title) params.set('stitle', video.search_title);
  if (video.total_episodes > 1) params.set('stype', 'tv');
  if (record?.index) params.set('episode', String(record.index));
  // 普通播放页兼容短剧；保持私人影库、Emby 等 source/id 原值。
  return '/play?' + params.toString();
}
export function recordProgress(record: PlayRecord): number {
  return record.total_time > 0
    ? Math.min(100, Math.max(0, (record.play_time / record.total_time) * 100))
    : 0;
}
