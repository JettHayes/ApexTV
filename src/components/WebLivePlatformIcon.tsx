'use client';

import { Link, Radio } from 'lucide-react';
import { useState } from 'react';

// SVG glyphs: Simple Icons (CC0-1.0); Huya/Douyu artwork: official favicons.
const platforms: Record<string, { file: string; color?: string }> = {
  huya: { file: 'huya.ico' },
  bilibili: { file: 'bilibili.svg', color: '#00a1d6' },
  douyin: { file: 'douyin.svg', color: 'var(--ptv-text)' },
  douyu: { file: 'douyu.ico' },
  youtube: { file: 'youtube.svg', color: '#d62929' },
  twitch: { file: 'twitch.svg', color: '#9146ff' },
};

export default function WebLivePlatformIcon({ platform }: { platform: string }) {
  const [failed, setFailed] = useState('');
  if (platform === 'custom') return <Link className='h-7 w-7 text-teal-700 dark:text-teal-300' aria-hidden='true' />;
  const item = platforms[platform];
  if (!item || failed === item.file) return <Radio className='h-6 w-6 text-gray-500' aria-hidden='true' />;
  const src = `/platforms/${item.file}`;
  if (item.color) return <span className='block h-8 w-8' aria-hidden='true' style={{ backgroundColor: item.color, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt='' aria-hidden='true' className='h-8 w-8 object-contain' onError={() => setFailed(item.file)} />
  );
}
