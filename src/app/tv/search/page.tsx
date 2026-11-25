'use client';

import { formatAppError, readJsonResponse, reportAppError } from '@/lib/app-error';


import { Film, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { addSearchHistory, getSearchHistory } from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import TVLayout from '@/components/tv/TVLayout';

const hot = ['庆余年', '流浪地球', '繁花', '甄嬛传', '鬼灭之刃', '歌手', '三体', '权力的游戏'];

function getSearchCacheKey(query: string) {
  return `search_cache_${query.trim()}`;
}

function setCachedSearchResults(query: string, nextResults: SearchResult[]) {
  try {
    sessionStorage.setItem(
      getSearchCacheKey(query),
      JSON.stringify({
        status: 'complete',
        results: nextResults,
        query: query.trim(),
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage failures
  }
}

type TVSearchDisplayItem = {
  key: string;
  title: string;
  poster?: string;
  year?: string;
  vodRemarks?: string;
  sourceName?: string;
  sourceNames: string[];
  source?: string;
  id?: string;
  isAggregate: boolean;
};

function normalizeTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[第\s._\-:：]+/g, '')
    .replace(/[（(].*?[）)]/g, '');
}

function getResultType(item: SearchResult) {
  const text = `${item.type_name || ''} ${item.class || ''}`.toLowerCase();
  if (text.includes('电影') || text.includes('movie')) return 'movie';
  return 'tv';
}

function getValidYear(item: SearchResult) {
  return item.year && /^\d{4}$/.test(item.year) ? item.year : 'unknown';
}

function getTVDetailUrl(item: TVSearchDisplayItem) {
  const params = new URLSearchParams({
    title: item.title,
  });
  if (!item.isAggregate && item.source) params.set('source', item.source);
  if (!item.isAggregate && item.id) params.set('id', item.id);
  return `/tv/detail?${params.toString()}`;
}

export default function TVSearchPage() {
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState('');
  const [error, setError] = useState('');
  const firstResultRef = useRef<HTMLButtonElement | null>(null);
  const searchRequestRef = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    getSearchHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(() => () => searchRequestRef.current?.abort(), []);

  const runSearch = (value: string) => {
    const q = value.trim();
    if (!q) return;
    searchRequestRef.current?.abort();
    const controller = new AbortController();
    searchRequestRef.current = controller;
    setKeyword(q);
    setSearched(q);
    setLoading(true);
    setError('');
    setResults([]);
    addSearchHistory(q).catch(() => undefined);
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) await readJsonResponse(response, "电视端");
        return readJsonResponse<any>(response, "电视端");
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const nextResults = Array.isArray(data.results) ? data.results : [];
        setResults(nextResults);
        setCachedSearchResults(q, nextResults);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(formatAppError(reportAppError(err, "电视端"), "电视端"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    runSearch(keyword);
  };

  const displayResults = useMemo<TVSearchDisplayItem[]>(() => {
    const groups = new Map<string, SearchResult[]>();
    const order: string[] = [];

    results.forEach((item) => {
      const key = `${normalizeTitle(item.title)}-${getResultType(item)}-${getValidYear(item)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)?.push(item);
    });

    return order.map((key) => {
      const group = groups.get(key) || [];
      const first = group[0];
      const sourceNames = Array.from(new Set(group.map((item) => item.source_name || item.source).filter(Boolean)));
      const bestPoster = group.find((item) => item.poster)?.poster || first?.poster || '';
      const bestYear = group.find((item) => getValidYear(item) !== 'unknown')?.year || first?.year || '';
      const bestRemarks = group.find((item) => item.vod_remarks)?.vod_remarks || first?.vod_remarks || '';

      return {
        key,
        title: first?.title || '',
        poster: bestPoster,
        year: bestYear,
        vodRemarks: bestRemarks,
        sourceName: first?.source_name || first?.source || '',
        sourceNames,
        source: first?.source,
        id: first?.id,
        isAggregate: group.length > 1,
      };
    });
  }, [results]);

  useEffect(() => {
    if (loading || error || displayResults.length === 0) return;
    window.requestAnimationFrame(() => {
      firstResultRef.current?.focus({ preventScroll: true });
      firstResultRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  }, [displayResults.length, error, loading]);

  return (
    <TVLayout>
      <div data-tv-focus-scope='active' className='f1-tv-search-page'>
        <form onSubmit={submit} className='f1-tv-search-form'>
          <Search aria-hidden='true' />
          <label className='sr-only' htmlFor='tv-search'>搜索片名</label>
          <input id='tv-search' autoFocus value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder='输入电影、剧集、动漫、综艺名称' className='tv-focusable' />
          <button type='submit' className='tv-focusable'>搜索</button>
        </form>
        <section className='f1-tv-search-chips'>
          <h2>热门搜索</h2>
          <div>{hot.map((item) => <button key={item} onClick={() => runSearch(item)} className='tv-focusable'>{item}</button>)}</div>
        </section>
        {(loading || searched || error) && (
          <section className='f1-tv-search-results'>
            <div className='f1-tv-search-heading'><h2>搜索结果</h2>
              {!loading && !error && <span>共 {displayResults.length} 个结果</span>}
              {loading && <span><Loader2 className='animate-spin' /> 搜索中...</span>}
            </div>
            {error ? <p role='alert'>{error}</p> : loading ? null : displayResults.length === 0 ? (
              <p>未找到相关结果</p>
            ) : (
              <div className='f1-tv-search-grid'>
                {displayResults.map((item, index) => (
                  <button key={item.key} ref={index === 0 ? firstResultRef : undefined}
                    onClick={() => router.push(getTVDetailUrl(item))} className='tv-focusable f1-tv-search-card'>
                    <div className='f1-tv-search-image'>
                      {item.poster ? <img src={processImageUrl(item.poster)} alt='' /> : <Film />}
                      {item.vodRemarks && <span>{item.vodRemarks}</span>}
                    </div>
                    <div className='f1-tv-search-card-copy'><strong>{item.title}</strong>
                      <small>{[item.year, item.isAggregate ? `${item.sourceNames.length} 个播放源` : item.sourceName].filter(Boolean).join(' · ')}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {history.length > 0 && <section className='f1-tv-search-chips'><h2>搜索历史</h2>
          <div>{history.slice(0, 20).map((item) => <button key={item} onClick={() => runSearch(item)} className='tv-focusable'>{item}</button>)}</div>
        </section>}
      </div>
    </TVLayout>
  );
}
