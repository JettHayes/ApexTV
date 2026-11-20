'use client';

import { getAuthInfoFromBrowserCookie } from './auth';
import { fetchWithAuth } from './db.client';
import {
  emptyPersonalLibrary,
  libraryKey,
  normalizeLibraryEntry,
  normalizeLibraryList,
} from './personal-library';
import type {
  LibraryEntry,
  LibraryList,
  LibraryVideo,
  PersonalLibrary,
  WatchState,
} from './personal-library';
import { filterRecordsBySpecialSourceContext } from './special-source.client';

export const PERSONAL_LIBRARY_UPDATED = 'apextv:personal-library-updated';
const cache = new Map<string, PersonalLibrary>();
const requests = new Map<string, Promise<PersonalLibrary>>();
const revisions = new Map<string, number>();
const account = () => getAuthInfoFromBrowserCookie()?.username || 'local';
const localKey = () =>
  'apextv:personal-library:' + encodeURIComponent(account());
export const libraryUsesCloud = () =>
  typeof window !== 'undefined' &&
  (window.RUNTIME_CONFIG?.STORAGE_TYPE || 'localstorage') !== 'localstorage';

function normalize(raw: unknown): PersonalLibrary {
  const result = emptyPersonalLibrary();
  if (!raw || typeof raw !== 'object') return result;
  const data = raw as PersonalLibrary;
  for (const entry of Object.values(data.entries || {})) {
    const clean = normalizeLibraryEntry(entry);
    if (clean) result.entries[libraryKey(clean)] = clean;
  }
  for (const value of Array.isArray(data.lists) ? data.lists : []) {
    const list = normalizeLibraryList(value);
    if (list && !result.lists.some((item) => item.id === list.id))
      result.lists.push(list);
  }
  return result;
}
function publish(data: PersonalLibrary) {
  cache.set(account(), data);
  window.dispatchEvent(new Event(PERSONAL_LIBRARY_UPDATED));
}
export function personalLibrarySnapshot(): PersonalLibrary {
  const data = cache.get(account()) || emptyPersonalLibrary();
  return {
    ...data,
    entries: filterRecordsBySpecialSourceContext(data.entries),
  };
}
async function request(path: string, init?: RequestInit) {
  const controller = new AbortController(),
    timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchWithAuth(path, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '操作失败，请重试');
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export function loadPersonalLibrary(): Promise<PersonalLibrary> {
  const user = account();
  const pending = requests.get(user);
  if (pending) return pending;
  const revision = revisions.get(user) || 0;
  const promise = (async () => {
    const data = libraryUsesCloud()
      ? normalize(await request('/api/personal-library'))
      : normalize(JSON.parse(localStorage.getItem(localKey()) || '{}'));
    if (account() === user && revision === (revisions.get(user) || 0))
      publish(data);
    return personalLibrarySnapshot();
  })().finally(() => requests.delete(user));
  requests.set(user, promise);
  return promise;
}
async function update(
  kind: 'entry' | 'list',
  key: string,
  value: LibraryEntry | LibraryList | null
) {
  const user = account();
  if (!cache.has(user)) await loadPersonalLibrary();
  if (user !== account()) throw new Error('账号已变化，请重新打开页面');
  let saved = value;
  if (libraryUsesCloud()) {
    if (value)
      saved = (
        await request('/api/personal-library', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, value }),
        })
      ).value;
    else
      await request(
        '/api/personal-library?' + new URLSearchParams({ kind, key }),
        { method: 'DELETE' }
      );
  }
  if (user !== account()) return;
  const data = cache.get(user) || emptyPersonalLibrary();
  const next = { entries: { ...data.entries }, lists: [...data.lists] };
  if (kind === 'entry') {
    if (saved) next.entries[key] = saved as LibraryEntry;
    else delete next.entries[key];
  } else {
    next.lists = next.lists.filter((list) => list.id !== key);
    if (saved) next.lists.push(saved as LibraryList);
  }
  if (!libraryUsesCloud())
    localStorage.setItem(localKey(), JSON.stringify(next));
  revisions.set(user, (revisions.get(user) || 0) + 1);
  publish(next);
}
export async function organizeVideo(
  video: LibraryVideo,
  patch: { status?: WatchState | ''; lists?: string[] }
) {
  if (!cache.has(account())) await loadPersonalLibrary();
  const current = cache.get(account())?.entries[libraryKey(video)];
  const entry = normalizeLibraryEntry({
    ...video,
    ...current,
    ...patch,
    updatedAt: Date.now(),
  });
  if (!entry) throw new Error('影片信息不完整');
  await update('entry', libraryKey(entry), entry);
}
export async function saveLibraryList(name: string, id = crypto.randomUUID()) {
  if (!cache.has(account())) await loadPersonalLibrary();
  if (
    cache
      .get(account())
      ?.lists.some((list) => list.id !== id && list.name === name.trim())
  )
    throw new Error('已有同名片单');
  const list = normalizeLibraryList({ id, name, updatedAt: Date.now() });
  if (!list) throw new Error('片单名称不能为空，最多 40 个字');
  await update('list', id, list);
}
export const removeLibraryEntry = (key: string) => update('entry', key, null);
export const removeLibraryList = (id: string) => update('list', id, null);
