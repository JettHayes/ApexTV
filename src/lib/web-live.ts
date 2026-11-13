export interface WebLiveRoomInfo {
  name?: string;
  title?: string;
  avatar?: string;
  cover?: string;
  category?: string;
}

export function webLivePlatformName(platform: string): string {
  return ({ huya: '虎牙', bilibili: '哔哩哔哩', douyin: '抖音' } as Record<string, string>)[platform] || platform;
}

// Platform artwork sometimes uses HTTP; keep images safe on an HTTPS page.
export function webLiveImageUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
}
