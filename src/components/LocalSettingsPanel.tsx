'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Gauge,
  Globe,
  HardDrive,
  MessageSquare,
  RotateCcw,
  Sliders,
  X,
} from 'lucide-react';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';

import { useLocalSettingsSync } from '@/hooks/useLocalSettingsSync';
import { clearAllDanmakuCache, getDanmakuCacheStats } from '@/lib/danmaku/api';
import {
  authorizeDownloadDirectory,
  chooseDownloadDirectory,
  getDownloadDirectoryStatus,
  supportsDownloadDirectory,
} from '@/lib/download-directory.client';
import {
  getBrowserStorageEstimate,
  getIndexedDBVideoStorageUsage,
} from '@/lib/indexeddb-video-cache';
import {
  DEFAULT_HOME_MODULES,
  getLocalSettingsDefaults,
  LOCAL_SETTINGS_CHANGED,
  LocalSettingKey,
  LocalSettings,
  readLocalSetting,
  resetLocalSettings,
  writeLocalSetting,
} from '@/lib/local-settings';
import { clearBangumiImageFallbackCache } from '@/lib/utils';

import './LocalSettingsPanel.css';

const categories = [
  {
    id: 'general',
    name: '常用',
    icon: Sliders,
    description: '搜索习惯与首页内容',
  },
  {
    id: 'playback',
    name: '播放与线路',
    icon: Gauge,
    description: '线路选择、缓冲与快捷操作',
  },
  {
    id: 'danmaku',
    name: '弹幕',
    icon: MessageSquare,
    description: '自动匹配、显示与缓存',
  },
  {
    id: 'downloads',
    name: '下载',
    icon: Download,
    description: '任务、存储空间与目录权限',
  },
  {
    id: 'network',
    name: '高级网络',
    icon: Globe,
    description: '数据与图片的请求渠道',
  },
] as const;
type Category = (typeof categories)[number]['id'];
type Option = readonly [string, string];
const doubanOptions: Option[] = [
  ['direct', '直连 · 服务器请求豆瓣'],
  ['cors-proxy-zwei', 'Cors Proxy By Zwei'],
  ['cmliussss-cdn-tencent', '豆瓣 CDN · 腾讯云'],
  ['cmliussss-cdn-ali', '豆瓣 CDN · 阿里云'],
  ['custom', '自定义代理'],
];
const imageOptions: Option[] = [
  ['server', '服务器代理'],
  ['cmliussss-cdn-tencent', '豆瓣 CDN · 腾讯云'],
  ['cmliussss-cdn-ali', '豆瓣 CDN · 阿里云'],
  ['custom', '自定义代理'],
  ['direct', '浏览器直连 · 可能受防盗链限制'],
  ['img3', '豆瓣 img3 CDN · 可能受防盗链限制'],
];
const animeOptions: Option[] = [
  ['direct', '浏览器直连 Bangumi'],
  ['server-proxy', '服务器代理'],
  ['sakura', '桜色镜像 · bgm.lat'],
  ['custom-baseurl', '自定义 Base URL'],
];

function readSettings(): LocalSettings {
  const values = getLocalSettingsDefaults();
  for (const key of Object.keys(values) as LocalSettingKey[])
    Object.assign(values, { [key]: readLocalSetting(key) });
  return values;
}
function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}
function SettingRow({
  id,
  title,
  description,
  children,
  badge,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <div className='ls-row'>
      <div className='ls-row-copy'>
        <label id={`${id}-label`} htmlFor={id}>
          {title}
        </label>
        {badge && <span className='ls-badge'>{badge}</span>}
        {description && <p id={`${id}-help`}>{description}</p>}
      </div>
      <div className='ls-control'>{children}</div>
    </div>
  );
}
function SettingSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='ls-section'>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function NumberSetting({
  id,
  value,
  min,
  max,
  step = 1,
  unit = '秒',
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(
      max ?? Number.MAX_SAFE_INTEGER,
      Math.max(min, Math.round(number))
    );
    setDraft(String(next));
    onChange(next);
  };
  return (
    <div className='ls-number'>
      <input
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        type='number'
        inputMode='numeric'
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <span>{unit}</span>
    </div>
  );
}

export function LocalSettingsPanel({
  open,
  onClose,
  onOpenDownloads,
}: {
  open: boolean;
  onClose: () => void;
  onOpenDownloads: () => void;
}) {
  const instanceId = useId();
  const [category, setCategory] = useState<Category>('general');
  const [settings, setSettings] = useState(getLocalSettingsDefaults({}));
  const [notice, setNotice] = useState('');
  const [cacheSize, setCacheSize] = useState('尚未读取');
  const [cacheBusy, setCacheBusy] = useState(false);
  const [storage, setStorage] = useState<{
    video: string;
    browser: string;
    quota: number;
    usage: number;
  } | null>(null);
  const [storageError, setStorageError] = useState('');
  const [directory, setDirectory] = useState<{
    name: string;
    permission: string;
  }>({ name: '', permission: 'missing' });
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [directorySupported, setDirectorySupported] = useState(false);
  const [workerScript, setWorkerScript] = useState('');
  const [workerError, setWorkerError] = useState('');
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sync = useLocalSettingsSync(open);
  const current = categories.find((item) => item.id === category)!;
  const id = (key: string) => `${instanceId}-${key}`;

  useEffect(() => {
    const update = () => setSettings(readSettings());
    update();
    window.addEventListener(LOCAL_SETTINGS_CHANGED, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(LOCAL_SETTINGS_CHANGED, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setSettings(readSettings());
      setNotice('');
    }
  }, [open]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [category]);
  useEffect(() => {
    if (!open || category !== 'danmaku') return;
    let active = true;
    getDanmakuCacheStats()
      .then((stats) => {
        if (active) setCacheSize(bytes(stats.totalSize));
      })
      .catch(() => {
        if (active) setCacheSize('暂时无法读取');
      });
    return () => {
      active = false;
    };
  }, [open, category]);

  const refreshStorage = async () => {
    setStorageError('');
    const [video, estimate, directoryResult] = await Promise.allSettled([
      getIndexedDBVideoStorageUsage(),
      getBrowserStorageEstimate(),
      getDownloadDirectoryStatus(),
    ]);
    setStorage({
      video:
        video.status === 'fulfilled'
          ? `${bytes(video.value.totalSize)} · ${video.value.count} 个完整视频`
          : '暂时无法读取',
      browser:
        estimate.status === 'fulfilled' && estimate.value?.usage !== undefined
          ? bytes(estimate.value.usage)
          : '浏览器未提供统计',
      usage: estimate.status === 'fulfilled' ? estimate.value?.usage ?? 0 : 0,
      quota: estimate.status === 'fulfilled' ? estimate.value?.quota ?? 0 : 0,
    });
    if (directoryResult.status === 'fulfilled')
      setDirectory(directoryResult.value);
    else setStorageError('目录状态读取失败，可重新选择目录');
  };
  useEffect(() => {
    if (!open || category !== 'downloads') return;
    setDirectorySupported(supportsDownloadDirectory());
    void refreshStorage();
  }, [open, category]);

  const update = <K extends LocalSettingKey>(
    key: K,
    value: LocalSettings[K]
  ) => {
    if (!writeLocalSetting(key, value))
      setNotice('浏览器无法保存设置，请检查存储权限或可用空间');
    else {
      setNotice('');
      if (key.startsWith('anime')) clearBangumiImageFallbackCache();
    }
  };
  const toggle = (
    key: LocalSettingKey,
    title: string,
    description: string,
    invert = false,
    badge?: string
  ) => (
    <SettingRow
      key={key}
      id={id(key)}
      title={title}
      description={description}
      badge={badge}
    >
      <label className='ls-toggle-hitbox' htmlFor={id(key)}>
        <input
          className='ls-switch'
          type='checkbox'
          role='switch'
          id={id(key)}
          aria-labelledby={`${id(key)}-label`}
          aria-describedby={`${id(key)}-help`}
          checked={invert ? !settings[key] : Boolean(settings[key])}
          onChange={(event) =>
            update(key, invert ? !event.target.checked : event.target.checked)
          }
        />
      </label>
    </SettingRow>
  );
  const select = (
    key: LocalSettingKey,
    title: string,
    options: readonly Option[],
    description?: string
  ) => (
    <SettingRow key={key} id={id(key)} title={title} description={description}>
      <div className='ls-select'>
        <select
          id={id(key)}
          aria-labelledby={`${id(key)}-label`}
          aria-describedby={description ? `${id(key)}-help` : undefined}
          value={String(settings[key])}
          onChange={(event) => update(key, event.target.value)}
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden='true' />
      </div>
    </SettingRow>
  );
  const text = (
    key: LocalSettingKey,
    title: string,
    placeholder: string,
    description?: string
  ) => (
    <SettingRow key={key} id={id(key)} title={title} description={description}>
      <input
        className='ls-text'
        id={id(key)}
        type='url'
        inputMode='url'
        autoCapitalize='none'
        spellCheck={false}
        aria-describedby={description ? `${id(key)}-help` : undefined}
        value={String(settings[key])}
        placeholder={placeholder}
        onChange={(event) => update(key, event.target.value)}
      />
    </SettingRow>
  );
  const number = (
    key: LocalSettingKey,
    title: string,
    description: string,
    min: number,
    max?: number,
    scale = 1,
    unit = '秒'
  ) => (
    <SettingRow key={key} id={id(key)} title={title} description={description}>
      <NumberSetting
        id={id(key)}
        value={Number(settings[key]) / scale}
        min={min}
        max={max}
        unit={unit}
        onChange={(value) => update(key, value * scale)}
      />
    </SettingRow>
  );
  const moveModule = (index: number, direction: -1 | 1) => {
    const modules = [...settings.homeModules];
    const other = index + direction;
    if (other < 0 || other >= modules.length) return;
    [modules[index], modules[other]] = [modules[other], modules[index]];
    update(
      'homeModules',
      modules.map((module, order) => ({ ...module, order }))
    );
  };
  const changeDirectory = async (authorize = false) => {
    setDirectoryBusy(true);
    setStorageError('');
    try {
      if (authorize) await authorizeDownloadDirectory();
      else await chooseDownloadDirectory();
      setDirectory(await getDownloadDirectoryStatus());
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError'))
        setStorageError(
          reason instanceof Error ? reason.message : '无法访问目录，请重新选择'
        );
    } finally {
      setDirectoryBusy(false);
    }
  };
  const close = () => {
    setConfirm(null);
    onClose();
  };
  const confirmReset = () =>
    setConfirm({
      title: '恢复全部本地设置？',
      message:
        '将恢复所有分类的默认设置。收藏、观看记录、已下载的视频和目录权限都会保留。',
      action: () => {
        try {
          resetLocalSettings();
          setNotice('已恢复默认设置');
        } catch {
          setNotice('恢复失败，请检查浏览器存储权限');
        }
      },
    });

  return (
    <Dialog open={open} onClose={close} className='ls-dialog'>
      <DialogBackdrop className='ls-backdrop' />
      <div className='ls-position'>
        <DialogPanel className='ls-panel'>
          <header className='ls-header'>
            <div>
              <DialogTitle>本地设置</DialogTitle>
              <p>按你的习惯，调整当前设备的体验</p>
            </div>
            <button
              className='ls-icon-button'
              onClick={close}
              aria-label='关闭本地设置'
            >
              <X size={21} />
            </button>
          </header>
          <div className='ls-layout'>
            <nav className='ls-nav' aria-label='设置分类'>
              {categories.map((item) => (
                <button
                  key={item.id}
                  aria-current={category === item.id ? 'page' : undefined}
                  onClick={() => setCategory(item.id)}
                >
                  <item.icon size={18} aria-hidden='true' />
                  <span>{item.name}</span>
                </button>
              ))}
              <button
                className='ls-reset'
                disabled={sync.busy}
                onClick={confirmReset}
              >
                <RotateCcw size={16} />
                <span>恢复默认</span>
              </button>
            </nav>
            <div ref={scrollRef} className='ls-content' key={category}>
              <div className='ls-content-heading'>
                <h2>{current.name}</h2>
                <p>{current.description}</p>
              </div>
              <fieldset className='ls-fields' disabled={sync.busy}>
                {category === 'general' && (
                  <>
                    <SettingSection title='影视搜索'>
                      {toggle(
                        'defaultAggregateSearch',
                        '合并同名搜索结果',
                        '默认按片名和年份聚合展示，仍可在搜索页切换。'
                      )}
                      {toggle(
                        'fluidSearch',
                        '实时展示搜索结果',
                        '影视、电子书和漫画搜索逐批显示结果，下次搜索生效。'
                      )}
                      {toggle(
                        'searchTraditionalToSimplified',
                        '搜索词转为简体',
                        '影视搜索时自动转换繁体关键词，不改变原始影片标题。'
                      )}
                      {toggle(
                        'exactSearch',
                        '只显示标题包含关键词的影片',
                        '关闭后保留更多近似结果，适合查找别名或不同译名。'
                      )}
                    </SettingSection>
                    <SettingSection title='首页布局'>
                      {toggle(
                        'homeBannerEnabled',
                        '推荐轮播',
                        '在首页展示大幅推荐。'
                      )}
                      {settings.homeBannerEnabled && (
                        <>
                          {select('homeBannerHeightScale', '轮播高度', [
                            ['1', '标准'],
                            ['1.5', '增高 · 1.5 倍'],
                            ['2', '特高 · 2 倍'],
                          ])}
                          {toggle(
                            'enableTrailers',
                            '轮播预告片',
                            '仅在 TMDB 轮播提供可用预告片时播放，可能增加网络流量。'
                          )}
                        </>
                      )}
                      {toggle(
                        'homeContinueWatchingEnabled',
                        '继续观看',
                        '首页展示你的观看进度。'
                      )}
                      <div className='ls-module-heading'>
                        <span>内容模块</span>
                        <span>显示与排序</span>
                      </div>
                      <ol className='ls-modules'>
                        {settings.homeModules.map((module, index) => (
                          <li key={module.id}>
                            <span
                              className='ls-module-order'
                              aria-hidden='true'
                            >
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className='ls-module-name'>
                              {module.name}
                            </span>
                            <div className='ls-module-actions'>
                              <button
                                aria-label={`${
                                  module.enabled ? '隐藏' : '显示'
                                }${module.name}`}
                                aria-pressed={module.enabled}
                                onClick={() =>
                                  update(
                                    'homeModules',
                                    settings.homeModules.map((entry) =>
                                      entry.id === module.id
                                        ? { ...entry, enabled: !entry.enabled }
                                        : entry
                                    )
                                  )
                                }
                              >
                                {module.enabled ? (
                                  <Eye size={17} />
                                ) : (
                                  <EyeOff size={17} />
                                )}
                              </button>
                              <button
                                aria-label={`上移${module.name}`}
                                disabled={index === 0}
                                onClick={() => moveModule(index, -1)}
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                aria-label={`下移${module.name}`}
                                disabled={
                                  index === settings.homeModules.length - 1
                                }
                                onClick={() => moveModule(index, 1)}
                              >
                                <ArrowDown size={16} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <button
                        className='ls-text-button'
                        onClick={() => {
                          update(
                            'homeModules',
                            DEFAULT_HOME_MODULES.map((module) => ({
                              ...module,
                            }))
                          );
                          update('homeBannerEnabled', true);
                          update('homeBannerHeightScale', '1');
                          update('homeContinueWatchingEnabled', true);
                        }}
                      >
                        恢复首页布局
                      </button>
                    </SettingSection>
                  </>
                )}
                {category === 'playback' && (
                  <>
                    <SettingSection title='线路选择'>
                      {toggle(
                        'enableOptimization',
                        '自动优选与测速',
                        '进入影片时优选可用线路，换源面板也可查看测速结果。'
                      )}
                      {settings.enableOptimization && (
                        <>
                          {select(
                            'preferStrategy',
                            '优选范围',
                            [
                              ['fast', '快速 · 优先检查高权重源'],
                              ['full', '全量 · 检查全部源'],
                            ],
                            '更改后用于下次优选，不会中断当前播放。'
                          )}
                          {select('preferMode', '优选偏好', [
                            ['balanced', '综合判定'],
                            ['resolution', '分辨率优先'],
                            ['speed', '网速优先'],
                          ])}
                          {number(
                            'speedTestTimeout',
                            '换源测速超时',
                            '只影响换源面板；自动优选仍使用 4 秒超时。',
                            4,
                            30,
                            1000
                          )}
                        </>
                      )}
                    </SettingSection>
                    <SettingSection title='普通影片播放'>
                      {select(
                        'bufferStrategy',
                        'HLS 缓冲',
                        [
                          ['low', '低 · 前向约 15 秒'],
                          ['medium', '标准 · 前向约 30 秒'],
                          ['high', '高 · 前向约 60 秒'],
                          ['ultra', '超高 · 前向约 120 秒'],
                        ],
                        '适用于 HLS.js 内核；原生播放由浏览器控制。更高缓冲会增加内存和流量。'
                      )}
                      {toggle(
                        'nextEpisodePreCache',
                        '预加载下一集',
                        '当前集播放至 90% 时尝试预取下一集分片，会增加流量；受片源和跨域限制。'
                      )}
                      {toggle(
                        'tmdb_backdrop_disabled',
                        '影片背景图',
                        '显示普通播放页的 TMDB 剧照，不影响全站赛车背景。',
                        true
                      )}
                      {toggle(
                        'disablePlaybackThumbnail',
                        '进度条预览图',
                        '生成预览需要抽取视频帧，会额外消耗流量；下个视频生效。',
                        true,
                        '下个视频'
                      )}
                      {toggle(
                        'disableDuanjuVertical',
                        '短剧竖屏入口',
                        '允许短剧进入竖屏播放器；竖屏播放器使用独立的缓冲与操作逻辑。',
                        true
                      )}
                      {toggle(
                        'disableEpisodeTitleFetch',
                        '获取分集标题',
                        '关闭后使用数字选集，不自动切换到标题列表。',
                        true,
                        '下次进入影片'
                      )}
                    </SettingSection>
                    <SettingSection title='快捷操作'>
                      {number(
                        'seekStepSeconds',
                        '方向键快进 / 后退',
                        '普通播放页按 ← / → 的跳转时长。',
                        1
                      )}
                      {number(
                        'quickForwardSeconds',
                        '快捷快进',
                        '普通播放页按 P 或点击快捷快进按钮的跳转时长。',
                        1
                      )}
                    </SettingSection>
                    <SettingSection title='电视直播'>
                      {toggle(
                        'liveAutoSpeedTest',
                        '自动测速线路',
                        '自动检查当前电视分组的线路，不影响网络直播。'
                      )}
                      {toggle(
                        'saveLivePlayRecords',
                        '保存电视直播观看记录',
                        '开启后保存频道观看记录；关闭不会删除已有记录。'
                      )}
                    </SettingSection>
                  </>
                )}
                {category === 'danmaku' && (
                  <>
                    <div className='ls-note'>
                      以下设置用于普通影片播放器。自动匹配、预加载与当前弹幕的显示开关相互独立。
                    </div>
                    <SettingSection title='匹配与显示'>
                      {toggle(
                        'disableAutoLoadDanmaku',
                        '自动匹配弹幕',
                        '关闭后仍可在播放器中手动匹配。',
                        true
                      )}
                      {toggle(
                        'nextEpisodeDanmakuPreload',
                        '预加载下一集弹幕',
                        '当前集播放至 90% 时预加载；关闭自动匹配时暂停预加载。'
                      )}
                      {toggle(
                        'danmaku_heatmap_disabled',
                        '弹幕热力图',
                        '显示弹幕密度分布和播放器内的热力开关，下个视频生效。',
                        true
                      )}
                      {toggle(
                        'danmakuTraditionalToSimplified',
                        '弹幕转为简体',
                        '重新装填弹幕后生效。'
                      )}
                      {number(
                        'danmakuMaxCount',
                        '单集弹幕上限',
                        '0 表示无上限。限制数量可以降低渲染开销，重新装填弹幕后生效。',
                        0,
                        100000,
                        1,
                        '条'
                      )}
                    </SettingSection>
                    <SettingSection title='弹幕缓存'>
                      <div className='ls-storage-line'>
                        <div>
                          <span>当前占用</span>
                          <strong>{cacheSize}</strong>
                        </div>
                        <button
                          className='ls-button'
                          disabled={cacheBusy}
                          onClick={() =>
                            setConfirm({
                              title: '清除弹幕缓存？',
                              message:
                                '只清除本机已缓存的弹幕，不影响影片、收藏和观看记录。',
                              action: () => {
                                setCacheBusy(true);
                                void clearAllDanmakuCache()
                                  .then(() => {
                                    setCacheSize('0 B');
                                    setNotice('弹幕缓存已清除');
                                  })
                                  .catch(() =>
                                    setNotice('清除失败，请稍后重试')
                                  )
                                  .finally(() => setCacheBusy(false));
                              },
                            })
                          }
                        >
                          {cacheBusy ? '清除中…' : '清除缓存'}
                        </button>
                      </div>
                    </SettingSection>
                  </>
                )}
                {category === 'downloads' && (
                  <>
                    <SettingSection title='下载任务'>
                      {number(
                        'maxConcurrentDownloads',
                        '同时下载任务',
                        '限制同时进行的任务数量，新任务或队列调度时生效。',
                        1,
                        10,
                        1,
                        '个'
                      )}
                      {number(
                        'downloadThreadsPerTask',
                        '单任务分片并发',
                        '每个任务并行下载的分片数。手机建议适当降低，避免占满连接和内存。',
                        1,
                        32,
                        1,
                        '个'
                      )}
                      {number(
                        'downloadSegmentTimeout',
                        '分片超时',
                        '超时后按当前分片重试策略处理，下一次启动任务生效。',
                        30,
                        300,
                        1000
                      )}
                      {select(
                        'downloadMode',
                        '保存方式',
                        [
                          ['browser', '浏览器下载 · 合并单文件'],
                          ...(directorySupported
                            ? [['filesystem', '本地目录 · 保存分片'] as const]
                            : []),
                          ['indexeddb', '应用内缓存 · 离线观看'],
                        ],
                        '保存方式仅用于当前设备，不上传云端。大视频合并可能占用较多内存。'
                      )}
                      {!directorySupported && (
                        <p className='ls-note'>
                          此浏览器不支持选择本地目录，可使用浏览器下载或应用内缓存。
                        </p>
                      )}
                    </SettingSection>
                    {directorySupported && (
                      <SettingSection title='本地目录'>
                        <div className='ls-directory'>
                          <FolderOpen size={21} aria-hidden='true' />
                          <div>
                            <strong>{directory.name || '尚未选择目录'}</strong>
                            <p>
                              {directory.permission === 'granted'
                                ? '已获得读写授权'
                                : directory.permission === 'denied'
                                ? '访问被拒绝，请重新授权或选择目录'
                                : directory.name
                                ? '需要重新授权'
                                : '只在当前浏览器保存，不随云端备份迁移'}
                            </p>
                          </div>
                          <div className='ls-inline-actions'>
                            {directory.name &&
                              directory.permission !== 'granted' && (
                                <button
                                  className='ls-button'
                                  disabled={directoryBusy}
                                  onClick={() => void changeDirectory(true)}
                                >
                                  重新授权
                                </button>
                              )}
                            <button
                              className='ls-button'
                              disabled={directoryBusy}
                              onClick={() => void changeDirectory()}
                            >
                              {directoryBusy
                                ? '处理中…'
                                : directory.name
                                ? '更换目录'
                                : '选择目录'}
                            </button>
                          </div>
                        </div>
                        {storageError && (
                          <p role='status' className='ls-error'>
                            {storageError}
                          </p>
                        )}
                      </SettingSection>
                    )}
                    <SettingSection title='本机存储'>
                      <div className='ls-storage-stats'>
                        <div>
                          <span>应用内视频缓存</span>
                          <strong>{storage?.video ?? '读取中…'}</strong>
                        </div>
                        <div>
                          <span>本站浏览器存储总占用</span>
                          <strong>{storage?.browser ?? '读取中…'}</strong>
                        </div>
                      </div>
                      {storage && storage.quota > 0 && (
                        <>
                          <meter
                            min={0}
                            max={storage.quota}
                            value={Math.min(storage.usage, storage.quota)}
                            aria-label='本站存储配额使用量'
                          />
                          <p className='ls-help'>
                            浏览器当前配额约 {bytes(storage.quota)}
                            ，并非磁盘剩余空间。无痕窗口或系统清理可能移除缓存。
                          </p>
                        </>
                      )}
                      <div className='ls-inline-actions'>
                        <button
                          className='ls-button ls-button-primary'
                          onClick={onOpenDownloads}
                        >
                          <HardDrive size={16} />
                          管理下载文件
                        </button>
                        <button
                          className='ls-text-button'
                          onClick={() => void refreshStorage()}
                        >
                          刷新状态
                        </button>
                      </div>
                    </SettingSection>
                  </>
                )}
                {category === 'network' && (
                  <>
                    <div className='ls-note'>
                      仅在图片或资料加载异常时调整。备用渠道在主渠道失败后使用；修改后重新请求的数据生效。
                    </div>
                    <details className='ls-network-section'>
                      <summary>
                        豆瓣资料与图片
                        <ChevronDown size={17} />
                      </summary>
                      <div>
                        {select(
                          'doubanDataSource',
                          '资料主渠道',
                          doubanOptions
                        )}
                        {settings.doubanDataSource === 'custom' &&
                          text(
                            'doubanProxyUrl',
                            '资料代理地址',
                            'https://proxy.example.com/fetch?url=',
                            '未填写时按直连处理。'
                          )}
                        {select(
                          'doubanDataSourceBackup',
                          '资料备用渠道',
                          doubanOptions
                        )}
                        {settings.doubanDataSourceBackup === 'custom' &&
                          text(
                            'doubanProxyUrlBackup',
                            '备用资料代理地址',
                            'https://proxy.example.com/fetch?url='
                          )}
                        {select(
                          'doubanImageProxyType',
                          '图片主渠道',
                          imageOptions
                        )}
                        {settings.doubanImageProxyType === 'custom' &&
                          text(
                            'doubanImageProxyUrl',
                            '图片代理地址',
                            'https://proxy.example.com/fetch?url='
                          )}
                        {select(
                          'doubanImageProxyTypeBackup',
                          '图片备用渠道',
                          imageOptions
                        )}
                        {settings.doubanImageProxyTypeBackup === 'custom' &&
                          text(
                            'doubanImageProxyUrlBackup',
                            '备用图片代理地址',
                            'https://proxy.example.com/fetch?url='
                          )}
                      </div>
                    </details>
                    <details className='ls-network-section'>
                      <summary>
                        TMDB 图片
                        <ChevronDown size={17} />
                      </summary>
                      <div>
                        {text(
                          'tmdbImageBaseUrl',
                          '图片请求地址',
                          'https://image.tmdb.org',
                          '只影响图片，不改变影片资料来源。'
                        )}
                      </div>
                    </details>
                    <details className='ls-network-section'>
                      <summary>
                        动漫资料与图片
                        <ChevronDown size={17} />
                      </summary>
                      <div>
                        {select('animeDataSource', '资料主渠道', animeOptions)}
                        {select(
                          'animeDataSourceBackup',
                          '资料备用渠道',
                          animeOptions
                        )}
                        {(settings.animeDataSource === 'custom-baseurl' ||
                          settings.animeDataSourceBackup ===
                            'custom-baseurl') &&
                          text(
                            'animeCustomBaseUrl',
                            '自定义 Base URL',
                            'https://api.bgm.tv',
                            '填写兼容 Bangumi API 的地址；留空使用官方地址。'
                          )}
                        {text(
                          'animeImageBaseUrl',
                          '图片 Base URL',
                          'https://proxy.example.com',
                          '留空使用当前渠道默认的图片地址。'
                        )}
                        <details className='ls-worker'>
                          <summary
                            onClick={() => {
                              if (workerScript) return;
                              setWorkerError('');
                              void fetch('/scripts/bangumi-proxy.worker.js')
                                .then((response) => {
                                  if (!response.ok) throw new Error();
                                  return response.text();
                                })
                                .then(setWorkerScript)
                                .catch(() =>
                                  setWorkerError(
                                    '脚本加载失败，请收起后重新展开'
                                  )
                                );
                            }}
                          >
                            部署自己的 Bangumi 代理
                            <ChevronDown size={15} />
                          </summary>
                          <p className='ls-help'>
                            可选工具。将脚本部署到自己的 Cloudflare
                            Workers，再填写上方的自定义地址。
                          </p>
                          <textarea
                            readOnly
                            aria-label='Bangumi Workers 代理脚本'
                            value={workerScript || workerError || '读取脚本中…'}
                            rows={5}
                          />
                          <button
                            className='ls-button'
                            disabled={!workerScript}
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(workerScript)
                                .then(() => setNotice('代理脚本已复制'))
                                .catch(() =>
                                  setNotice('复制失败，请手动选择脚本复制')
                                )
                            }
                          >
                            复制脚本
                          </button>
                        </details>
                      </div>
                    </details>
                  </>
                )}
              </fieldset>
            </div>
          </div>
          <footer className='ls-footer'>
            <button
              className='ls-text-button ls-reset-mobile'
              disabled={sync.busy}
              onClick={confirmReset}
            >
              <RotateCcw size={14} />
              恢复默认
            </button>
            <div className='ls-save-state'>
              <Check size={15} aria-hidden='true' />
              <span>
                {sync.available
                  ? sync.mode === 'auto'
                    ? '修改保存在本机，关闭面板时同步到云端'
                    : '修改保存在本机，可手动备份到云端'
                  : '修改自动保存在当前浏览器'}
              </span>
            </div>
            {sync.available && (
              <div className='ls-inline-actions'>
                <button
                  className='ls-text-button'
                  disabled={sync.busy}
                  onClick={() =>
                    setConfirm({
                      title: '备份当前设置？',
                      message:
                        '将覆盖账户的云端设置副本。不会上传下载目录权限、视频文件、收藏或观看记录。',
                      action: () => {
                        void sync.push();
                      },
                    })
                  }
                >
                  <Cloud size={15} />
                  {sync.busy ? '同步中…' : '备份'}
                </button>
                <button
                  className='ls-text-button'
                  disabled={sync.busy}
                  onClick={() =>
                    setConfirm({
                      title: '恢复云端设置？',
                      message:
                        '将覆盖本机可同步的偏好设置。本机下载方式、目录权限、视频文件、收藏和观看记录会保留。',
                      action: () => {
                        void sync.pull();
                      },
                    })
                  }
                >
                  恢复
                </button>
              </div>
            )}
            {(notice || sync.message) && (
              <p
                role='status'
                className={sync.error && !notice ? 'ls-error' : 'ls-status'}
              >
                {notice || sync.message}
              </p>
            )}
          </footer>
          <Dialog
            open={Boolean(confirm)}
            onClose={() => setConfirm(null)}
            className='ls-confirm-dialog'
          >
            <DialogBackdrop className='ls-backdrop' />
            <div className='ls-position'>
              <DialogPanel className='ls-confirm'>
                <DialogTitle>{confirm?.title}</DialogTitle>
                <p>{confirm?.message}</p>
                <div className='ls-inline-actions'>
                  <button
                    className='ls-button'
                    data-autofocus
                    onClick={() => setConfirm(null)}
                  >
                    取消
                  </button>
                  <button
                    className='ls-button ls-button-primary'
                    onClick={() => {
                      const action = confirm?.action;
                      setConfirm(null);
                      action?.();
                    }}
                  >
                    确认
                  </button>
                </div>
              </DialogPanel>
            </div>
          </Dialog>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
