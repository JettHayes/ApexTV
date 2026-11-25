import 'server-only';
import { getStorage } from './db';

interface HashStorage {
  hGetAll(key: string): Promise<Record<string, string>>;
  hSet(key: string, field: string, value: string): Promise<unknown>;
  hDel(key: string, field: string): Promise<unknown>;
}
export function personalLibraryStorage(): HashStorage {
  const storage = getStorage() as unknown as HashStorage & {
    client?: HashStorage;
    adapter?: HashStorage;
  };
  const hash = [storage.client, storage.adapter, storage].find((candidate) =>
    candidate && typeof candidate.hGetAll === 'function' &&
    typeof candidate.hSet === 'function' && typeof candidate.hDel === 'function'
  );
  if (!hash)
    throw new Error('当前存储不支持个人整理数据');
  return hash;
}
export function personalLibraryNamespace(username: string): string {
  return (
    'apextv:personal-library:' + Buffer.from(username, 'utf8').toString('hex')
  );
}
