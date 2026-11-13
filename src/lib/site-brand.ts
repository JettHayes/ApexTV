export const DEFAULT_SITE_NAME = 'ApexTV';

const legacyNames = new Set(['moontv', 'moontvplus', 'moontv plus', 'petronas tv']);

export function resolveSiteName(value?: string | null): string {
  const name = value?.trim();
  return !name || legacyNames.has(name.toLowerCase()) ? DEFAULT_SITE_NAME : name;
}
