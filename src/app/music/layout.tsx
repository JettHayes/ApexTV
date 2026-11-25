import { MUSIC_TYPE_SCALE } from '@/components/music/tokens';

import './music.css';

import MusicClient from './MusicClient';

export default function MusicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 保留原字号标尺；字体复用全站本地资源，不再额外下载三套模块字体。
    <div
      style={MUSIC_TYPE_SCALE}
      className='f1-music-module'
    >
      <MusicClient>{children}</MusicClient>
    </div>
  );
}
