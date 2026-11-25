'use client';

import { Link, Radio } from 'lucide-react';
import { useState } from 'react';

// SVG glyphs: Simple Icons (CC0-1.0); Huya/Douyu artwork: official favicons.
const platforms: Record<string, { file: string; color?: string }> = {
  huya: { file: 'huya.ico' },
  bilibili: { file: 'bilibili.svg', color: 'var(--ptv-platform-bilibili)' },
  douyin: { file: 'douyin.svg', color: 'var(--ptv-text)' },
  douyu: { file: 'douyu.ico' },
  youtube: { file: 'youtube.svg', color: 'var(--ptv-platform-youtube)' },
  twitch: { file: 'twitch.svg', color: 'var(--ptv-platform-twitch)' },
};

export default function WebLivePlatformIcon({ platform }: { platform: string }) {
  const [failed, setFailed] = useState('');
  if (platform === 'custom') return <Link className='h-7 w-7 text-[var(--ptv-accent)]' aria-hidden='true' />;
  const item = platforms[platform];
  if (!item || failed === item.file) return <Radio className='h-6 w-6 text-[var(--ptv-muted)]' aria-hidden='true' />;
  const src = `/platforms/${item.file}`;
  if (item.color) return <span className='block h-8 w-8' aria-hidden='true' style={{ backgroundColor: item.color, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt='' aria-hidden='true' className='h-8 w-8 object-contain' onError={() => setFailed(item.file)} />
  );
}
