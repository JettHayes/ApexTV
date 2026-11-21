'use client';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Heart,
  History,
  MoreHorizontal,
  Play,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { usePersonalLibrary } from '@/hooks/usePersonalLibrary';
import {
  clearAllFavorites,
  clearAllPlayRecords,
  deleteFavorite,
  deletePlayRecords,
  saveFavorite,
} from '@/lib/db.client';
import type { PlayRecord } from '@/lib/db.client';
import {
  libraryPlaybackUrl,
  recordProgress,
  videoFromRecord,
  WATCH_STATES,
} from '@/lib/personal-library';
import type { LibraryVideo } from '@/lib/personal-library';
import {
  libraryUsesCloud,
  removeLibraryEntry,
  removeLibraryList,
  saveLibraryList,
} from '@/lib/personal-library.client';

import LibraryPoster from './LibraryPoster';
import OrganizeVideoDialog from './OrganizeVideoDialog';
import PageLayout from './PageLayout';
import './PersonalLibrary.css';

const views = [
  {
    id: 'favorites',
    title: '我的收藏',
    icon: Heart,
    intro: '喜欢的影片、自己的片单，都在这里。',
  },
  {
    id: 'history',
    title: '最近观看',
    icon: History,
    intro: '从上次停下的位置，继续看。',
  },
  {
    id: 'watch-later',
    title: '稍后观看',
    icon: Bookmark,
    intro: '先存下来，留给下一次放松的时间。',
  },
] as const;
type Item = LibraryVideo & { key: string; time: number; record?: PlayRecord };
const PAGE_SIZE = 100;

export default function PersonalLibraryPage({ view }: { view: string }) {
  const { favorites, records, library, loading, error, reload } =
    usePersonalLibrary();
  const current = views.find((item) => item.id === view) || views[0];
  const [query, setQuery] = useState(''),
    [source, setSource] = useState(''),
    [state, setState] = useState(''),
    [list, setList] = useState('');
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState<LibraryVideo | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [listName, setListName] = useState(''),
    [showListForm, setShowListForm] = useState(false);
  const [listError, setListError] = useState('');
  const [confirm, setConfirm] = useState<{
    title: string;
    copy: string;
    renameId?: string;
    action: () => Promise<void>;
  } | null>(null);
  useEffect(() => {
    setPage(1);
    setQuery('');
    setSource('');
    setState('');
    setList('');
  }, [view]);
  useEffect(() => setPage(1), [query, source, state, list]);
  useEffect(() => {
    if (list && !library.lists.some((item) => item.id === list)) setList('');
  }, [library.lists, list]);

  const all = useMemo(() => {
    const result: Record<string, Item> = {};
    for (const [key, value] of Object.entries(favorites)) {
      const video = videoFromRecord(key, value);
      if (video)
        result[key] = {
          ...video,
          key,
          time: value.save_time,
          record: records[key],
        };
    }
    for (const [key, entry] of Object.entries(library.entries)) {
      result[key] = {
        ...entry,
        key,
        time: entry.updatedAt,
        record: records[key],
      };
    }
    return result;
  }, [favorites, records, library.entries]);
  const items = useMemo(() => {
    const base: Item[] =
      current.id === 'history'
        ? Object.entries(records).flatMap(([key, record]) => {
            const video = videoFromRecord(key, record);
            return video
              ? [{ ...video, key, time: record.save_time, record }]
              : [];
          })
        : Object.values(all).filter((item) =>
            current.id === 'watch-later'
              ? library.entries[item.key]?.status === 'later'
              : list
              ? library.entries[item.key]?.lists.includes(list)
              : Boolean(favorites[item.key])
          );
    return base.sort((a, b) => b.time - a.time || a.key.localeCompare(b.key));
  }, [current.id, records, all, library.entries, list, favorites]);
  const sources = Array.from(new Set(items.map((item) => item.source_name)))
    .filter(Boolean)
    .sort();
  const filtered = items.filter(
    (item) =>
      (!query.trim() ||
        (item.title + ' ' + item.year)
          .toLowerCase()
          .includes(query.trim().toLowerCase())) &&
      (!source || item.source_name === source) &&
      (!state || library.entries[item.key]?.status === state)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    safePage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const groups =
    current.id === 'history'
      ? visible.reduce<Record<string, Item[]>>((groups, item) => {
          const date = new Date(item.time).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          (groups[date] ||= []).push(item);
          return groups;
        }, {})
      : { '': visible };
  async function action(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setNotice('');
    try {
      await fn();
      setNotice(success);
      setConfirm(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  }
  const activeList = library.lists.find((item) => item.id === list);
  return (
    <PageLayout activePath={'/my/' + current.id}>
      <div className='my-page f1-personal-library'>
        <header className='my-heading f1-media-heading'>
          <div>
            <p className='my-eyebrow'>个人媒体库</p>
            <h1>{current.title}</h1>
            <p>{current.intro}</p>
          </div>
          {current.id === 'favorites' && (
            <button
              className='my-button'
              onClick={() => {
                setShowListForm((value) => !value);
                setListName('');
                setListError('');
              }}
            >
              <FolderPlus size={17} />
              新建片单
            </button>
          )}
        </header>
        {current.id === 'favorites' && (
          <div className='my-collections'>
            <button aria-pressed={!list} onClick={() => setList('')}>
              全部收藏 <span>{Object.keys(favorites).length}</span>
            </button>
            {library.lists.map((item) => (
              <button
                key={item.id}
                aria-pressed={list === item.id}
                onClick={() => setList(item.id)}
              >
                {item.name}
                <span>
                  {
                    Object.values(library.entries).filter((entry) =>
                      entry.lists.includes(item.id)
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
        )}
        {activeList && current.id === 'favorites' && (
          <div className='my-active-list'>
            <h2>{activeList.name}</h2>
            <button
              className='my-text-button'
              onClick={() => {
                setListName(activeList.name);
                setShowListForm(false);
                setConfirm({
                  title: '重命名片单',
                  copy: '输入新的片单名称。',
                  renameId: activeList.id,
                  action: async () => {},
                });
              }}
            >
              重命名
            </button>
            <button
              className='my-text-button my-danger'
              onClick={() =>
                setConfirm({
                  title: '删除这个片单？',
                  copy: '只删除片单，收藏、稍后观看和观看记录都会保留。',
                  action: () => removeLibraryList(activeList.id),
                })
              }
            >
              删除片单
            </button>
          </div>
        )}
        <div className='my-toolbar'>
          <label className='my-search'>
            <Search size={18} aria-hidden='true' />
            <span className='sr-only'>搜索当前列表</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='搜索片名或年份'
            />
            {query && (
              <button
                className='my-icon-button'
                aria-label='清除搜索'
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <label className='my-filter'>
            <span className='sr-only'>筛选来源</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value=''>全部来源</option>
              {sources.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          {current.id !== 'watch-later' && (
            <label className='my-filter'>
              <span className='sr-only'>筛选观看状态</span>
              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
              >
                <option value=''>全部状态</option>
                {Object.entries(WATCH_STATES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className='my-summary'>
          <span>
            {filtered.length} 部{query && '符合搜索'}
            {filtered.length > PAGE_SIZE && ' · 每页 100 部'}
          </span>
          <span>
            {current.id === 'history' ? '按最近观看排序' : '按最近保存排序'}
          </span>
          {items.length > 0 && !list && current.id !== 'watch-later' && (
            <button
              className='my-text-button my-danger'
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title:
                    current.id === 'history'
                      ? '清空所有观看记录？'
                      : '清空所有收藏？',
                  copy:
                    '会移除当前入口的全部' +
                    (current.id === 'history' ? '观看记录' : '收藏') +
                    '，包括筛选条件外的内容。片单、观看计划和已下载文件会保留。',
                  action:
                    current.id === 'history'
                      ? clearAllPlayRecords
                      : clearAllFavorites,
                })
              }
            >
              清空{current.id === 'history' ? '记录' : '收藏'}
            </button>
          )}
        </div>
        {error && (
          <div role='alert' className='my-error'>
            {error}
            <button className='my-text-button' onClick={reload}>
              重试
            </button>
          </div>
        )}
        {notice && (
          <p className='my-notice' role='status'>
            {notice}
            <button
              className='my-icon-button'
              aria-label='关闭提示'
              onClick={() => setNotice('')}
            >
              <X size={15} />
            </button>
          </p>
        )}
        {loading && !items.length ? (
          <div className='my-loading' role='status'>
            正在整理你的内容…
          </div>
        ) : !visible.length ? (
          <div className='my-empty'>
            <current.icon size={32} />
            <h2>
              {query || source || state
                ? '没有符合条件的影片'
                : current.id === 'history'
                ? '下一次观看，会留在这里'
                : current.id === 'watch-later'
                ? '给下一次观影留个位置'
                : activeList
                ? '片单还空着'
                : '收藏你喜欢的内容'}
            </h2>
            <p>
              {query || source || state
                ? '试试其他片名，或清除筛选条件。'
                : current.id === 'watch-later' || activeList
                ? '在影片卡片的更多菜单或播放页中，选择“整理影片”即可加入。'
                : '搜索影片，开始播放或添加收藏。'}
            </p>
            <Link
              className='my-button my-primary'
              href='/search'
              prefetch={false}
            >
              <Search size={16} />
              去找影片
            </Link>
          </div>
        ) : (
          Object.entries(groups).map(([date, group]) => (
            <section key={date} className='my-section'>
              {date && (
                <h2>
                  {date}
                  <span>{group.length} 部</span>
                </h2>
              )}
              <div className='my-grid'>
                {group.map((item) => {
                  const entry = library.entries[item.key],
                    favorited = Boolean(favorites[item.key]),
                    progress = item.record ? recordProgress(item.record) : 0;
                  return (
                    <article className='my-video' key={item.key}>
                      <Link
                        className='my-poster'
                        href={libraryPlaybackUrl(item, item.record)}
                        prefetch={false}
                        aria-label={'播放 ' + item.title}
                      >
                        <LibraryPoster src={item.cover} title={item.title} />
                        <span className='my-poster-play'>
                          <Play size={24} fill='currentColor' />
                        </span>
                        {entry?.status && (
                          <span className='my-state-badge'>
                            {WATCH_STATES[entry.status]}
                          </span>
                        )}
                        {item.record && item.record.origin !== 'live' && (
                          <span
                            className='my-record-progress'
                            aria-label={
                              '观看进度 ' + Math.round(progress) + '%'
                            }
                          >
                            <span style={{ width: progress + '%' }} />
                          </span>
                        )}
                      </Link>
                      <div className='my-video-title'>
                        <Link
                          href={libraryPlaybackUrl(item, item.record)}
                          prefetch={false}
                        >
                          {item.title}
                        </Link>
                        <button
                          className='my-icon-button'
                          aria-label={'整理 ' + item.title}
                          onClick={() => setEditing(item)}
                        >
                          <MoreHorizontal size={19} />
                        </button>
                      </div>
                      <p className='my-video-meta'>
                        {item.year && item.year !== 'unknown'
                          ? item.year + ' · '
                          : ''}
                        {item.source_name || '已保存影片'}
                      </p>
                      {item.record && (
                        <p className='my-video-meta'>
                          {item.record.origin === 'live'
                            ? '最近访问的频道'
                            : (item.total_episodes > 1
                                ? '第 ' + item.record.index + ' 集 · '
                                : '') +
                              Math.floor(item.record.play_time / 60) +
                              ' / ' +
                              Math.floor(item.record.total_time / 60) +
                              ' 分钟'}
                        </p>
                      )}
                      <div className='my-card-actions'>
                        <button
                          className='my-text-button'
                          disabled={busy || item.source === 'discovery'}
                          aria-pressed={favorited}
                          onClick={() =>
                            favorited
                              ? setConfirm({
                                  title: '取消收藏？',
                                  copy: '片单与观看记录会保留。',
                                  action: () =>
                                    deleteFavorite(item.source, item.id),
                                })
                              : action(
                                  () =>
                                    saveFavorite(item.source, item.id, {
                                      title: item.title,
                                      source_name: item.source_name || '影片',
                                      cover: item.cover,
                                      year: item.year,
                                      total_episodes: item.total_episodes,
                                      save_time: Date.now(),
                                      search_title: item.search_title,
                                      origin: item.origin,
                                    }),
                                  '已添加收藏'
                                )
                          }
                        >
                          <Heart
                            size={14}
                            fill={favorited ? 'currentColor' : 'none'}
                          />
                          {favorited ? '已收藏' : '收藏'}
                        </button>
                        {current.id === 'history' ? (
                          <button
                            className='my-text-button'
                            onClick={() =>
                              setConfirm({
                                title: '移除这条观看记录？',
                                copy: '收藏、片单及已下载文件不受影响。',
                                action: () => deletePlayRecords([item.key]),
                              })
                            }
                          >
                            移除记录
                          </button>
                        ) : (
                          entry && (
                            <button
                              className='my-text-button'
                              onClick={() =>
                                setConfirm({
                                  title: '移除整理信息？',
                                  copy: '会清除这部影片的观看计划及片单归属，原有收藏和观看记录会保留。',
                                  action: () => removeLibraryEntry(item.key),
                                })
                              }
                            >
                              移除整理
                            </button>
                          )
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
        {totalPages > 1 && (
          <nav className='my-pagination' aria-label='个人内容分页'>
            <button
              className='my-button'
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft size={16} />
              上一页
            </button>
            <span>
              {safePage} / {totalPages}
            </span>
            <button
              className='my-button'
              disabled={safePage === totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              下一页
              <ChevronRight size={16} />
            </button>
          </nav>
        )}
        <p className='my-storage-note'>
          <Check size={13} />
          {libraryUsesCloud()
            ? '收藏、记录和整理信息按当前账号保存'
            : '内容保存在当前浏览器'}{' '}
          · 观看状态由你手动管理
        </p>
      </div>
      {editing && (
        <OrganizeVideoDialog video={editing} onClose={() => setEditing(null)} />
      )}
      <Dialog
        open={showListForm && current.id === 'favorites'}
        onClose={() => {
          if (!busy) setShowListForm(false);
        }}
        className='my-dialog'
      >
        <DialogBackdrop className='my-dialog-backdrop' />
        <div className='my-dialog-position'>
          <DialogPanel className='my-list-editor'>
            <header>
              <div>
                <span className='my-list-editor-kicker'>
                  <FolderPlus size={16} />
                  我的片单
                </span>
                <DialogTitle>新建片单</DialogTitle>
                <p>把想一起看的影片，收进同一份片单。</p>
              </div>
              <button
                type='button'
                className='my-icon-button'
                aria-label='关闭新建片单'
                disabled={busy}
                onClick={() => setShowListForm(false)}
              >
                <X size={19} />
              </button>
            </header>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy || !listName.trim()) return;
                setBusy(true);
                setListError('');
                try {
                  await saveLibraryList(listName);
                  setShowListForm(false);
                  setListName('');
                  setNotice('片单已创建');
                } catch (error) {
                  setListError(
                    error instanceof Error ? error.message : '创建失败，请重试'
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor='my-list-name'>片单名称</label>
              <div className='my-list-name-field'>
                <input
                  id='my-list-name'
                  autoFocus
                  maxLength={40}
                  value={listName}
                  disabled={busy}
                  onChange={(event) => setListName(event.target.value)}
                  placeholder='例如：演唱会现场'
                  required
                />
                <span aria-hidden='true'>{listName.length}/40</span>
              </div>
              {listError && (
                <p className='my-list-editor-error' role='alert'>
                  {listError}
                </p>
              )}
              <footer>
                <button
                  type='button'
                  className='my-button'
                  disabled={busy}
                  onClick={() => setShowListForm(false)}
                >
                  取消
                </button>
                <button
                  type='submit'
                  className='my-button my-primary'
                  disabled={busy || !listName.trim()}
                >
                  {busy ? '正在创建…' : '创建片单'}
                </button>
              </footer>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        className='my-dialog'
      >
        <DialogBackdrop className='my-dialog-backdrop' />
        <div className='my-dialog-position'>
          <DialogPanel className='my-confirm'>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <p>{confirm?.copy}</p>
            {confirm?.title === '重命名片单' && (
              <input
                aria-label='新的片单名称'
                value={listName}
                maxLength={40}
                onChange={(event) => setListName(event.target.value)}
              />
            )}
            <div className='my-confirm-actions'>
              <button
                className='my-button'
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                取消
              </button>
              <button
                className='my-button my-primary'
                disabled={busy}
                onClick={() => {
                  if (confirm) {
                    const selected = confirm;
                    action(
                      selected.renameId
                        ? () => saveLibraryList(listName, selected.renameId)
                        : selected.action,
                      '已保存'
                    );
                  }
                }}
              >
                {busy ? '正在处理…' : '确认'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </PageLayout>
  );
}
