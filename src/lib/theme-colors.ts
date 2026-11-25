/** Resolve semantic CSS colors for Canvas, metadata and isolated reader documents. */
export function readThemeColor(token: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

export function resolveThemeColor(value: string): string {
  const match = value.match(/^var\((--[\w-]+)\)$/);
  return match ? readThemeColor(match[1]) : value;
}

/** Color-input based integrations need a concrete hex value rather than a CSS var(). */
export function readThemeColorAsHex(token: string): string {
  const color = readThemeColor(token);
  const channels = color.match(/[\d.]+/g);
  return channels && channels.length >= 3
    ? '#' +
        channels
          .slice(0, 3)
          .map((v) => Math.round(Number(v)).toString(16).padStart(2, '0'))
          .join('')
    : color;
}
