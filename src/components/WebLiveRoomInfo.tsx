'use client';

import { Radio } from 'lucide-react';
import { useState } from 'react';

import { type WebLiveRoomInfo, webLiveImageUrl, webLivePlatformName, webLiveSourceLabel } from '@/lib/web-live';

export function WebLiveAvatar({ avatar, cover }: Pick<WebLiveRoomInfo, 'avatar' | 'cover'>) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const url = [webLiveImageUrl(avatar), webLiveImageUrl(cover)].find((item) => item && !failedUrls.includes(item));
  return (
    <span className='ptv-room-avatar' aria-hidden='true'>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt='' width={56} height={56} referrerPolicy='no-referrer' loading='lazy' onError={() => setFailedUrls((previous) => [...previous, url])} />
      ) : <Radio size={24} />}
    </span>
  );
}

export default function WebLiveRoomDetails({ source, info, loading, error }: {
  source: { name: string; platform: string; roomId: string };
  info: WebLiveRoomInfo | null;
  loading: boolean;
  error: boolean;
}) {
  const title = info?.title || source.name;
  const owner = info?.name;
  return (
    <section className='ptv-room-info' aria-label='直播间信息' aria-busy={loading}>
      <WebLiveAvatar avatar={info?.avatar} cover={info?.cover} />
      <div className='ptv-room-copy'>
        <div className='ptv-room-heading'>
          <h2>{title}</h2>
          <span className='ptv-room-state' data-state={error ? 'error' : loading ? 'loading' : info?.liveStatus === 'live' ? 'ready' : 'unknown'}>
            {error ? '连接失败' : loading ? '获取中' : info?.liveStatus === 'live' ? '直播中' : info?.liveStatus === 'offline' ? '未开播' : '状态未知'}
          </span>
        </div>
        {owner && owner !== title && <p className='ptv-room-owner'>{owner}</p>}
        <div className='ptv-room-meta'>
          <span className='ptv-room-platform'>{webLivePlatformName(source.platform)}</span>
          {info?.category && <span>{info.category}</span>}
          {info?.anchorId && <span>主播 ID: {info.anchorId}</span>}
          <span className='ptv-room-id'>{source.platform === 'youtube' && info?.liveStatus === 'live' && info?.roomId ? '当前直播 ' + info.roomId : webLiveSourceLabel({ ...source, roomId: info?.roomId || source.roomId })}</span>
        </div>
      </div>
    </section>
  );
}
