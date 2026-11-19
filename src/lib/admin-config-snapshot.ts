import type { AdminConfig } from './admin.types';

const snapshots = new WeakMap<object, AdminConfig>();
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function trackAdminConfig<T extends AdminConfig>(config: T, origin?: AdminConfig): T {
  const base = origin ? snapshots.get(origin) || origin : config;
  snapshots.set(config, copy(base));
  return config;
}

export function getAdminConfigSnapshot(config: AdminConfig): AdminConfig | undefined {
  const base = snapshots.get(config);
  return base ? copy(base) : undefined;
}

export class AdminConfigConflictError extends Error {
  constructor() { super('配置已被其他操作修改，请刷新后重新保存'); }
}

function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && same(a[key], b[key]));
}

function stableArrayKey(arrays: any[][]): string | undefined {
  const entries = arrays.flat();
  if (!entries.length) return undefined;
  return ['key', 'id', 'username'].find((key) => entries.every((item) => item && typeof item === 'object' && !Array.isArray(item) && ['string', 'number'].includes(typeof item[key])) && arrays.every((items) => new Set(items.map((item) => String(item[key]))).size === items.length));
}

function mergeValue(base: any, next: any, current: any): any {
  if (same(next, base)) return current;
  if (same(current, base) || same(next, current)) return next;
  if (Array.isArray(base) && Array.isArray(next) && Array.isArray(current)) {
    const key = stableArrayKey([base, next, current]);
    if (!key) throw new AdminConfigConflictError();
    const map = (items: any[]) => new Map(items.map((item) => [String(item[key]), item]));
    const before = map(base), desired = map(next), latest = map(current);
    const merged = new Map<string, any>();
    for (const id of Array.from(new Set([...Array.from(before.keys()), ...Array.from(desired.keys()), ...Array.from(latest.keys())]))) {
      const value = mergeValue(before.get(id), desired.get(id), latest.get(id));
      if (value !== undefined) merged.set(id, value);
    }
    const common = (items: any[]) => items.map((item) => String(item[key])).filter((id) => before.has(id) && desired.has(id) && latest.has(id));
    const originalOrder = common(base), nextOrder = common(next), currentOrder = common(current);
    const nextReordered = !same(originalOrder, nextOrder);
    if (nextReordered && !same(originalOrder, currentOrder) && !same(nextOrder, currentOrder)) throw new AdminConfigConflictError();
    const primary = nextReordered ? next : current;
    const secondary = nextReordered ? current : next;
    const order = primary.map((item) => String(item[key])).filter((id) => merged.has(id));
    if (nextReordered) {
      for (const item of secondary) {
        const id = String(item[key]);
        if (merged.has(id) && !order.includes(id)) order.push(id);
      }
      return order.map((id) => merged.get(id));
    }
    for (let i = 0; i < secondary.length; i++) {
      const id = String(secondary[i][key]);
      if (!merged.has(id) || order.includes(id)) continue;
      const previous = secondary.slice(0, i).map((item) => String(item[key])).reverse().find((candidate) => order.includes(candidate));
      const following = secondary.slice(i + 1).map((item) => String(item[key])).find((candidate) => order.includes(candidate));
      const position = previous ? order.indexOf(previous) + 1 : following ? order.indexOf(following) : order.length;
      order.splice(position, 0, id);
    }
    return order.map((id) => merged.get(id));
  }
  if (base && next && current && [base, next, current].every((value) => typeof value === 'object' && !Array.isArray(value))) {
    const result: Record<string, any> = {};
    for (const key of Array.from(new Set([...Object.keys(base), ...Object.keys(next), ...Object.keys(current)]))) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new AdminConfigConflictError();
      const value = mergeValue(base[key], next[key], current[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  throw new AdminConfigConflictError();
}

export function mergeAdminConfig(base: AdminConfig, next: AdminConfig, current: AdminConfig): AdminConfig {
  return copy(mergeValue(copy(base), copy(next), copy(current)));
}

export function removeUnsupportedLiveSources(config: AdminConfig): AdminConfig {
  if (Array.isArray(config.WebLiveConfig)) config.WebLiveConfig = config.WebLiveConfig.filter((source) => source.platform !== 'kuaishou');
  return config;
}
