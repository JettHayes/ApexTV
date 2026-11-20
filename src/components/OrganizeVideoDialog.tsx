'use client';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { Check, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { libraryKey, WATCH_STATES } from '@/lib/personal-library';
import type {
  LibraryVideo,
  PersonalLibrary,
  WatchState,
} from '@/lib/personal-library';
import {
  libraryUsesCloud,
  loadPersonalLibrary,
  organizeVideo,
  saveLibraryList,
} from '@/lib/personal-library.client';
import './PersonalLibrary.css';

export default function OrganizeVideoDialog({
  video,
  onClose,
  mode = 'organize',
}: {
  video: LibraryVideo;
  onClose: () => void;
  mode?: 'organize' | 'lists';
}) {
  const [library, setLibrary] = useState<PersonalLibrary>({
    entries: {},
    lists: [],
  });
  const [status, setStatus] = useState<WatchState | ''>('');
  const [lists, setLists] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadPersonalLibrary()
      .then((data) => {
        if (!active) return;
        const entry = data.entries[libraryKey(video)];
        setLibrary(data);
        setStatus(entry?.status || '');
        setLists(entry?.lists || []);
        setReady(true);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error ? error.message : '加载失败，请重新打开'
          );
      });
    return () => {
      active = false;
    };
  }, [video.source, video.id]);
  async function createList() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      if (library.lists.some((list) => list.name === name.trim()))
        throw new Error('已有同名片单');
      const id = crypto.randomUUID();
      await saveLibraryList(name.trim(), id);
      setLibrary((data) => ({
        ...data,
        lists: [
          ...data.lists,
          { id, name: name.trim(), updatedAt: Date.now() },
        ],
      }));
      setLists((data) => [...data, id]);
      setName('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建失败');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await organizeVideo(video, { status, lists });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      className='my-dialog'
    >
      <DialogBackdrop className='my-dialog-backdrop' />
      <div className='my-dialog-position'>
        <DialogPanel className='my-organizer'>
          <header>
            <div>
              <DialogTitle>
                {mode === 'lists' ? '加入片单' : '整理影片'}
              </DialogTitle>
              <p>{video.title}</p>
            </div>
            <button
              className='my-icon-button'
              onClick={onClose}
              disabled={busy}
              aria-label='关闭'
            >
              <X size={20} />
            </button>
          </header>
          <div className='my-organizer-body'>
            {!ready && !error && <p role='status'>正在读取整理信息…</p>}
            {mode !== 'lists' && (
              <fieldset disabled={!ready || busy}>
                <legend>观看计划</legend>
                <div className='my-state-options'>
                  {Object.entries(WATCH_STATES).map(([value, label]) => (
                    <button
                      type='button'
                      key={value}
                      aria-pressed={status === value}
                      onClick={() =>
                        setStatus(status === value ? '' : (value as WatchState))
                      }
                    >
                      <span>{label}</span>
                      {status === value && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset disabled={!ready || busy}>
              <legend>
                加入片单 <span>可选多个</span>
              </legend>
              {library.lists.length ? (
                <div className='my-list-choices'>
                  {library.lists.map((list) => (
                    <label key={list.id}>
                      <input
                        type='checkbox'
                        checked={lists.includes(list.id)}
                        onChange={(event) =>
                          setLists((old) =>
                            event.target.checked
                              ? [...old, list.id]
                              : old.filter((id) => id !== list.id)
                          )
                        }
                      />
                      <span>{list.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className='my-muted'>
                  还没有片单。可以创建“演唱会现场”或“周末想看”。
                </p>
              )}
              <form
                className='my-create-list'
                onSubmit={(event) => {
                  event.preventDefault();
                  createList();
                }}
              >
                <label className='sr-only' htmlFor='my-new-list-name'>
                  新片单名称
                </label>
                <input
                  id='my-new-list-name'
                  value={name}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                  placeholder='新片单名称'
                />
                <button className='my-button' disabled={!name.trim() || busy}>
                  <Plus size={16} />
                  新建
                </button>
              </form>
            </fieldset>
            {error && (
              <p className='my-error' role='alert'>
                {error}
              </p>
            )}
          </div>
          <footer>
            <span className='my-muted'>
              {libraryUsesCloud()
                ? '保存到当前账号，多设备可用'
                : '保存在当前浏览器'}
            </span>
            <button
              className='my-button my-primary'
              onClick={save}
              disabled={!ready || busy}
            >
              {busy ? '正在保存…' : '保存'}
            </button>
          </footer>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
