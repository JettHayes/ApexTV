import { createHash } from 'crypto';

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}

export function adminConfigVersion(config: object): string {
  return createHash('sha256').update(JSON.stringify(canonical(config))).digest('hex');
}
