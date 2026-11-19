import type { AdminConfig } from './admin.types';

const versions = new WeakMap<AdminConfig, string>();

export function registerAdminConfigVersion(config: AdminConfig, revision?: string): void {
  if (revision) versions.set(config, revision);
}

export function getAdminConfigVersion(config: AdminConfig | null): string {
  const revision = config && versions.get(config);
  if (!revision) throw new Error('配置版本不可用，请刷新管理页面后重试');
  return revision;
}

export function adminConfigSaveError(status: number, fallback: string): Error {
  return new Error(status === 409 || status === 428 ? '配置已变化或版本失效，请刷新页面后重试' : fallback);
}

export function mergePendingOrder<T>(pending: T[], latest: T[], key: (item: T) => string): T[] {
  const remaining = new Map(latest.map((item) => [key(item), item]));
  const merged: T[] = [];
  for (const item of pending) {
    const id = key(item);
    const updated = remaining.get(id);
    if (updated !== undefined) {
      merged.push(updated);
      remaining.delete(id);
    }
  }
  for (const item of latest) {
    const id = key(item);
    if (remaining.has(id)) {
      merged.push(item);
      remaining.delete(id);
    }
  }
  return merged;
}
