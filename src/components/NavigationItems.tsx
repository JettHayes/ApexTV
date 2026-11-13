/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Blend, BookOpen, Cat, Clover, Container, Film, Globe, Home, Library, Music2, Search, Star, Tv, TvMinimalPlay, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useWatchRoomContextSafe } from './WatchRoomProvider';

export function useNavigationItems(searchHref = '/search') {
  const watchRoom = useWatchRoomContextSafe();
  const [config, setConfig] = useState<Record<string, any>>({});
  useEffect(() => {
    setConfig(window.RUNTIME_CONFIG || {});
  }, []);

  const primary = [
    { icon: Home, label: '首页', href: '/' },
    { icon: Search, label: '搜索', href: searchHref },
    ...(config.PRIVATE_LIBRARY_ENABLED ? [{ icon: Container, label: '私人影库', href: '/private-library' }] : []),
    ...(config.LIVE_ENABLED ? [{ icon: TvMinimalPlay, label: '电视直播', href: '/live' }] : []),
    ...(config.WEB_LIVE_ENABLED ? [{ icon: Globe, label: '网络直播', href: '/web-live' }] : []),
    ...(config.MUSIC_ENABLED ? [{ icon: Music2, label: '音乐', href: '/music/rankings' }] : []),
  ];
  const categories = [
    { icon: Film, label: '电影', href: '/douban?type=movie' },
    { icon: Tv, label: '剧集', href: '/douban?type=tv' },
    { icon: Cat, label: '动漫', href: '/douban?type=anime' },
    { icon: Clover, label: '综艺', href: '/douban?type=show' },
    ...(config.CUSTOM_CATEGORIES?.length ? [{ icon: Star, label: '自定义', href: '/douban?type=custom' }] : []),
  ];
  const other = [
    ...(config.SUWAYOMI_ENABLED ? [{ icon: Library, label: '漫画', href: '/manga' }] : []),
    ...(config.BOOKS_ENABLED ? [{ icon: BookOpen, label: '电子书', href: '/books' }] : []),
    ...(config.ADVANCED_RECOMMENDATION_ENABLED ? [{ icon: Blend, label: '高级推荐', href: '/advanced-recommendation' }] : []),
    ...(watchRoom?.isEnabled ? [{ icon: Users, label: '观影室', href: '/watch-room' }] : []),
  ];
  return { primary, categories, other, config };
}

export function navigationActive(pathname: string, query: string, href: string) {
  const [path, params] = href.split('?');
  if (params) return pathname === path && new URLSearchParams(query).get('type') === new URLSearchParams(params).get('type');
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');
}
