'use client';

import { ArrowDownUp, Check, Download, Film, Server, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import ProxyImage from '@/components/ProxyImage';

interface DownloadEpisodeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  totalEpisodes: number;
  episodesTitles?: string[];
  videoTitle: string;
  videoPoster?: string;
  sourceName?: string;
  qualityLabel?: string;
  currentEpisodeIndex: number;
  onDownload: (episodeIndexes: number[], offlineMode: boolean) => void;
  enableOfflineDownload?: boolean;
  hasOfflinePermission?: boolean;
}

export default function DownloadEpisodeSelector({
  isOpen, onClose, totalEpisodes, episodesTitles = [], videoTitle, videoPoster, sourceName,
  qualityLabel, currentEpisodeIndex, onDownload, enableOfflineDownload = false, hasOfflinePermission = false,
}: DownloadEpisodeSelectorProps) {
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<number>>(new Set([currentEpisodeIndex]));
  const [offlineMode, setOfflineMode] = useState(false);
  const episodesPerPage = 50;
  const pageCount = Math.ceil(totalEpisodes / episodesPerPage);
  const [currentPage, setCurrentPage] = useState(Math.floor(currentEpisodeIndex / episodesPerPage));
  const [descending, setDescending] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const openedContentRef = useRef('');
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) { openedContentRef.current = ''; return; }
    const key = videoTitle + ':' + totalEpisodes;
    if (openedContentRef.current === key) return;
    openedContentRef.current = key;
    const index = Math.max(0, Math.min(currentEpisodeIndex, totalEpisodes - 1));
    setSelectedEpisodes(new Set(totalEpisodes > 0 ? [index] : []));
    setCurrentPage(Math.floor(index / episodesPerPage));
    setOfflineMode(false);
  }, [isOpen, videoTitle, totalEpisodes, currentEpisodeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]') || []).filter((node) => node.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [isOpen]);

  const safePage = Math.min(currentPage, Math.max(0, pageCount - 1));
  const displayPage = descending ? pageCount - 1 - safePage : safePage;
  const categories = useMemo(() => {
    const labels = Array.from({ length: pageCount }, (_, index) => ({
      start: index * episodesPerPage + 1,
      end: Math.min((index + 1) * episodesPerPage, totalEpisodes),
    }));
    return descending ? labels.reverse().map(({ start, end }) => end + '–' + start) : labels.map(({ start, end }) => start + '–' + end);
  }, [pageCount, descending, totalEpisodes]);
  const currentStart = safePage * episodesPerPage;
  const currentEnd = Math.min(currentStart + episodesPerPage, totalEpisodes);
  const visibleEpisodes = Array.from({ length: Math.max(0, currentEnd - currentStart) }, (_, index) => descending ? currentEnd - index - 1 : currentStart + index);
  const allSelected = totalEpisodes > 0 && selectedEpisodes.size === totalEpisodes;
  const handleEpisodeClick = (index: number) => setSelectedEpisodes((previous) => {
    const next = new Set(previous);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
  const episodeLabel = (index: number) => {
    const title = episodesTitles[index];
    if (!title) return '第 ' + (index + 1) + ' 集';
    if (/^OVA\s+\d+/i.test(title)) return title;
    const match = title.match(/(?:第)?(\d+)(?:集|话)/);
    return match ? '第 ' + match[1] + ' 集' : title;
  };
  const handleDownload = () => {
    const indexes = Array.from(selectedEpisodes).filter((index) => index >= 0 && index < totalEpisodes).sort((a, b) => a - b);
    if (!indexes.length) return;
    onDownload(indexes, offlineMode && enableOfflineDownload && hasOfflinePermission);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className='f1-download-overlay ptv-scrim-in' onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role='dialog' aria-modal='true' aria-labelledby='download-episode-title' tabIndex={-1} className='f1-download-reference ptv-modal-in'>
        <header className='f1-download-heading'>
          <div><h2 id='download-episode-title'><Download size={19} aria-hidden />下载选集</h2><p>选择要下载的剧集</p></div>
          <button type='button' onClick={onClose} aria-label='关闭下载选集'><X size={20} /></button>
        </header>
        <div className='f1-download-body'>
          <section className='f1-download-film' aria-label='当前影片'>
            <div className='f1-download-cover'>{videoPoster ? <ProxyImage originalSrc={videoPoster} alt={videoTitle} className='h-full w-full object-cover' /> : <Film size={26} aria-hidden />}</div>
            <div><h3>{videoTitle}</h3><p>共 {totalEpisodes} 集{sourceName ? ' · ' + sourceName : ''}</p></div>
          </section>
          <section className='f1-download-source' aria-label='下载片源'>
            <h3>当前下载片源</h3>
            <div><Film size={17} aria-hidden /><span><strong>{sourceName || '当前播放源'}</strong><small>{qualityLabel || '按当前片源提供的画质下载'}</small></span><Check size={17} aria-hidden /></div>
          </section>
          {enableOfflineDownload && hasOfflinePermission && (
            <section className='f1-download-offline'>
              <Server size={18} aria-hidden /><div><h3>服务器离线下载</h3><p>开启后将在服务器端下载视频文件，支持断点续传和后台下载</p></div>
              <button type='button' role='switch' aria-checked={offlineMode} aria-label='服务器离线下载' onClick={() => setOfflineMode((value) => !value)}><span /></button>
            </section>
          )}
          <div className='f1-download-selection-heading'><h3>选择剧集 <span>已选 {selectedEpisodes.size} 集</span></h3>
            <div><button type='button' onClick={() => allSelected ? setSelectedEpisodes(new Set()) : setSelectedEpisodes(new Set(Array.from({ length: totalEpisodes }, (_, index) => index)))} aria-pressed={allSelected}><span className='f1-download-check' data-checked={allSelected}>{allSelected && <Check size={11} />}</span>全选</button>
              <button type='button' onClick={() => setSelectedEpisodes(new Set())}>清空</button>
              <button type='button' onClick={() => setSelectedEpisodes((previous) => new Set([...Array.from(previous), ...visibleEpisodes]))}>选择本页</button>
            </div>
          </div>
          {pageCount > 1 && <nav className='f1-download-pages' aria-label='下载剧集分页'>
            <div>{categories.map((label, index) => <button type='button' key={label} aria-current={index === displayPage ? 'page' : undefined} onClick={() => setCurrentPage(descending ? pageCount - 1 - index : index)}>{label}</button>)}</div>
            <button type='button' onClick={() => setDescending((value) => !value)} aria-label={descending ? '切换为正序' : '切换为倒序'} title={descending ? '倒序' : '正序'}><ArrowDownUp size={16} /></button>
          </nav>}
          <div className='f1-download-episode-grid' role='group' aria-label='可下载剧集'>
            {visibleEpisodes.map((index) => {
              const selected = selectedEpisodes.has(index);
              return <button type='button' key={index} onClick={() => handleEpisodeClick(index)} aria-pressed={selected} title={episodesTitles[index] || '第 ' + (index + 1) + ' 集'} data-current={index === currentEpisodeIndex}>
                <span className='f1-download-check' data-checked={selected}>{selected && <Check size={11} />}</span><span>{episodeLabel(index)}</span>
              </button>;
            })}
          </div>
          {!totalEpisodes && <p className='f1-download-empty'>当前影片没有可下载的剧集。</p>}
        </div>
        <footer className='f1-download-footer'>
          <div><strong><Download size={15} aria-hidden />已选择 {selectedEpisodes.size} 集</strong><small>{offlineMode && enableOfflineDownload && hasOfflinePermission ? '保存到服务器离线下载' : '使用当前片源下载'}</small></div>
          <button type='button' className='f1-download-cancel' onClick={onClose}>取消</button>
          <button type='button' className='f1-download-confirm' onClick={handleDownload} disabled={selectedEpisodes.size === 0}><Download size={16} />确认{offlineMode && enableOfflineDownload && hasOfflinePermission ? '离线' : ''}下载</button>
        </footer>
      </section>
    </div>
  );
}
