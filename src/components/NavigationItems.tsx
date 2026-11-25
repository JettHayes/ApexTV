/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Bot, Link as LinkIcon, ListVideo, Bookmark, History, Heart, Blend, BookOpen, Cat, Clover, Container, Clapperboard, Film, Globe, Home, Library, Music2, Search, Star, Tv, TvMinimalPlay, Users } from 'lucide-react';
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
    ...(config.MUSIC_ENABLED ? [{ icon: Music2, label: '音乐空间', href: '/music/rankings' }] : []),
    ...(config.BOOKS_ENABLED ? [{ icon: BookOpen, label: '电子书馆', href: '/books' }] : []),
    ...(config.SUWAYOMI_ENABLED ? [{ icon: Library, label: '漫画书库', href: '/manga' }] : []),
  ];
  const categories = [
    { icon: Film, label: '电影', href: '/douban?type=movie' },
    { icon: Tv, label: '剧集', href: '/douban?type=tv' },
    { icon: Clover, label: '综艺', href: '/douban?type=show' },
    { icon: Clapperboard, label: '短剧', href: '/duanju' },
    { icon: Cat, label: '动漫', href: '/douban?type=anime' },
    ...(config.CUSTOM_CATEGORIES?.length ? [{ icon: Star, label: '自定义', href: '/douban?type=custom' }] : []),
  ];
  const personal = [
    { icon: Heart, label: '我的收藏', href: '/my/favorites' },
    { icon: History, label: '最近观看', href: '/my/history' },
    { icon: Bookmark, label: '观看计划', href: '/my/watch-later' },
  ];
  const other = [
    ...(config.ENABLE_SOURCE_SEARCH !== false ? [{ icon: ListVideo, label: '源站寻片', href: '/source-search' }] : []),
    { icon: LinkIcon, label: '直链播放', href: '/?action=direct-play' },
    ...(config.AI_ENABLED && config.AI_ENABLE_HOMEPAGE_ENTRY ? [{ icon: Bot, label: 'AI问片', href: '/?action=ai-chat' }] : []),
    ...(config.ADVANCED_RECOMMENDATION_ENABLED ? [{ icon: Blend, label: '高级推荐', href: '/advanced-recommendation' }] : []),
    ...(watchRoom?.isEnabled ? [{ icon: Users, label: '观影室', href: '/watch-room' }] : []),
  ];
  return { primary, categories, personal, other, config };
}

export function navigationActive(pathname: string, query: string, href: string) {
  const [path, params] = href.split('?');
  if (path === '/music/rankings' && (pathname === '/music' || pathname.startsWith('/music/'))) return true;
  if (params) {
    const current = new URLSearchParams(query);
    return pathname === path && Array.from(new URLSearchParams(params)).every(([key, value]) => current.get(key) === value);
  }
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');
}
