interface DirectoryHandle {
  name: string;
  queryPermission?: (options: {
    mode: 'readwrite';
  }) => Promise<PermissionState>;
  requestPermission?: (options: {
    mode: 'readwrite';
  }) => Promise<PermissionState>;
}

export function supportsDownloadDirectory(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function directoryStore(
  mode: IDBTransactionMode,
  value?: DirectoryHandle
): Promise<DirectoryHandle | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoonTVPlus', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('dirHandles'))
        db.createObjectStore('dirHandles');
      if (!db.objectStoreNames.contains('activeTasks')) {
        const store = db.createObjectStore('activeTasks', { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('completedTasks')) {
        const store = db.createObjectStore('completedTasks', { keyPath: 'id' });
        store.createIndex('source', 'source');
        store.createIndex('completedAt', 'completedAt');
        store.createIndex('sourceVideoId', ['source', 'videoId']);
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('目录数据库被其他页面占用，请关闭旧页面后重试'));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('dirHandles')) {
        db.close();
        resolve(undefined);
        return;
      }
      const transaction = db.transaction('dirHandles', mode);
      const store = transaction.objectStore('dirHandles');
      const operation =
        mode === 'readwrite'
          ? store.put(value, 'downloadDir')
          : store.get('downloadDir');
      let result: DirectoryHandle | undefined;
      operation.onsuccess = () => {
        result = mode === 'readwrite' ? value : operation.result;
      };
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onabort = transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}

export async function getDownloadDirectoryStatus() {
  if (!supportsDownloadDirectory())
    return { name: '', permission: 'unsupported' as const };
  const handle = await directoryStore('readonly');
  if (!handle) return { name: '', permission: 'missing' as const };
  const permission = handle.queryPermission
    ? await handle.queryPermission({ mode: 'readwrite' })
    : 'prompt';
  return { name: handle.name, permission };
}

export async function chooseDownloadDirectory() {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (options: {
        mode: 'readwrite';
      }) => Promise<DirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) throw new Error('当前浏览器不支持选择本地目录');
  // Keep the picker directly in the click gesture; do not await permission probes first.
  const handle = await picker.call(window, { mode: 'readwrite' });
  await directoryStore('readwrite', handle);
  return handle.name;
}

export async function authorizeDownloadDirectory() {
  const handle = await directoryStore('readonly');
  if (!handle) throw new Error('请先选择保存目录');
  return handle.requestPermission
    ? handle.requestPermission({ mode: 'readwrite' })
    : 'prompt';
}
