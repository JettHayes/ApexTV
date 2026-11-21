import type { WebLiveVariant } from './web-live';

export interface WebLivePreference {
  quality: string;
  cdn?: string;
  type: 'hls' | 'flv';
}

export const qualityName = (item: WebLiveVariant): string =>
  (item as WebLiveVariant & { qualityLabel?: string }).qualityLabel || item.label.split(/\s*·\s*/)[0];

export const qualityOptions = (items: WebLiveVariant[]): string[] =>
  Array.from(new Set(items.map(qualityName)));

export function chooseVariant(items: WebLiveVariant[], quality: string, cdn?: string, type?: 'hls' | 'flv'): WebLiveVariant | undefined {
  const matchingQuality = items.filter((item) => qualityName(item) === quality);
  const candidates = matchingQuality.length ? matchingQuality : items;
  return candidates.find((item) => item.cdn === cdn && item.type === type)
    || candidates.find((item) => item.cdn === cdn && item.type === 'hls')
    || candidates.find((item) => item.type === type)
    || candidates.find((item) => item.type === 'hls')
    || candidates[0];
}

export function resolveVariant(items: WebLiveVariant[], preference: WebLivePreference | null) {
  const selected = preference
    ? chooseVariant(items, preference.quality, preference.cdn, preference.type)
    : chooseVariant(items, items[0] ? qualityName(items[0]) : '', undefined, 'hls');
  const fallback = !!(preference && selected && (
    qualityName(selected) !== preference.quality || selected.cdn !== preference.cdn || selected.type !== preference.type
  ));
  return { selected, fallback };
}

/** 播放失败后优先换同画质线路，再尝试较低画质；不自动切到另一种协议。 */
export function recoveryVariant(items: WebLiveVariant[], preference: WebLivePreference | null, failed: ReadonlySet<string>): WebLiveVariant | undefined {
  if (!preference) return undefined;
  const available = items.filter((item) => item.type === preference.type && !failed.has(item.id));
  const sameQuality = available.find((item) => qualityName(item) === preference.quality);
  if (sameQuality) return sameQuality;
  const qualities = qualityOptions(items);
  const previousIndex = qualities.indexOf(preference.quality);
  if (previousIndex < 0) return undefined;
  return available.find((item) => qualities.indexOf(qualityName(item)) > previousIndex);
}
