export const DEFAULT_SITE_NAME = 'Apex TV';

const legacyNames = new Set(['moontv', 'moontvplus', 'moontv plus', 'petronas tv', 'apextv']);

export function resolveSiteName(value?: string | null): string {
  const name = value?.trim();
  return !name || legacyNames.has(name.toLowerCase()) ? DEFAULT_SITE_NAME : name;
}
