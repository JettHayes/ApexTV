import { LOCAL_SETTINGS_KEYS } from './local-settings-sync';
import {
  DEFAULT_QUICK_FORWARD_SECONDS,
  DEFAULT_SEEK_STEP_SECONDS,
} from './player-seek-settings';

export const LOCAL_SETTINGS_CHANGED = 'apextv:local-settings-changed';
export interface HomeModuleSetting {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

export const DEFAULT_HOME_MODULES: HomeModuleSetting[] = [
  { id: 'hotMovies', name: '热门电影', enabled: true, order: 0 },
  { id: 'hotDuanju', name: '热播短剧', enabled: true, order: 1 },
  { id: 'bangumiCalendar', name: '新番放送', enabled: true, order: 2 },
  { id: 'hotTvShows', name: '热门剧集', enabled: true, order: 3 },
  { id: 'hotVarietyShows', name: '热门综艺', enabled: true, order: 4 },
  { id: 'upcomingContent', name: '即将上映', enabled: true, order: 5 },
];

type RuntimeSettings = Record<string, unknown>;
export function getLocalSettingsDefaults(runtime?: RuntimeSettings) {
  const config =
    runtime ??
    (typeof window === 'undefined'
      ? {}
      : (window as Window & { RUNTIME_CONFIG?: RuntimeSettings })
          .RUNTIME_CONFIG ?? {});
  return {
    defaultAggregateSearch: true,
    saveLivePlayRecords: false,
    liveAutoSpeedTest: false,
    enableOptimization: true,
    preferStrategy: 'fast' as 'fast' | 'full',
    preferMode: 'balanced' as 'balanced' | 'resolution' | 'speed',
    speedTestTimeout: 4000,
    maxConcurrentDownloads: 6,
    downloadThreadsPerTask: 6,
    downloadSegmentTimeout: 30000,
    downloadMode: 'browser' as 'browser' | 'filesystem' | 'indexeddb',
    fluidSearch: config.FLUID_SEARCH !== false,
    tmdb_backdrop_disabled: false,
    enableTrailers: false,
    doubanProxyUrl:
      typeof config.DOUBAN_PROXY === 'string' ? config.DOUBAN_PROXY : '',
    doubanDataSource:
      typeof config.DOUBAN_PROXY_TYPE === 'string'
        ? config.DOUBAN_PROXY_TYPE
        : 'cmliussss-cdn-tencent',
    doubanDataSourceBackup: 'direct',
    doubanProxyUrlBackup: '',
    animeDataSource:
      typeof config.BANGUMI_DATA_SOURCE === 'string'
        ? config.BANGUMI_DATA_SOURCE
        : 'direct',
    animeDataSourceBackup: 'server-proxy',
    animeCustomBaseUrl: '',
    animeImageBaseUrl: '',
    doubanImageProxyType:
      typeof config.DOUBAN_IMAGE_PROXY_TYPE === 'string'
        ? config.DOUBAN_IMAGE_PROXY_TYPE
        : 'cmliussss-cdn-tencent',
    doubanImageProxyUrl:
      typeof config.DOUBAN_IMAGE_PROXY === 'string'
        ? config.DOUBAN_IMAGE_PROXY
        : '',
    doubanImageProxyTypeBackup: 'server',
    doubanImageProxyUrlBackup: '',
    tmdbImageBaseUrl:
      typeof config.TMDB_IMAGE_BASE_URL === 'string'
        ? config.TMDB_IMAGE_BASE_URL
        : 'https://image.tmdb.org',
    bufferStrategy: 'medium' as 'low' | 'medium' | 'high' | 'ultra',
    nextEpisodePreCache: true,
    nextEpisodeDanmakuPreload: true,
    disablePlaybackThumbnail: true,
    disableDuanjuVertical: false,
    disableEpisodeTitleFetch: false,
    disableAutoLoadDanmaku: config.DANMAKU_AUTO_LOAD_DEFAULT === false,
    danmakuMaxCount: 5000,
    danmaku_heatmap_disabled: false,
    homeBannerEnabled: true,
    homeBannerHeightScale: '1' as '1' | '1.5' | '2',
    homeContinueWatchingEnabled: true,
    homeModules: DEFAULT_HOME_MODULES.map((module) => ({ ...module })),
    danmakuTraditionalToSimplified: false,
    searchTraditionalToSimplified: false,
    exactSearch: true,
    quickForwardSeconds: DEFAULT_QUICK_FORWARD_SECONDS,
    seekStepSeconds: DEFAULT_SEEK_STEP_SECONDS,
  };
}

export type LocalSettings = ReturnType<typeof getLocalSettingsDefaults>;
export type LocalSettingKey = keyof LocalSettings;

const choices: Partial<Record<LocalSettingKey, readonly string[]>> = {
  preferStrategy: ['fast', 'full'],
  preferMode: ['balanced', 'resolution', 'speed'],
  downloadMode: ['browser', 'filesystem', 'indexeddb'],
  bufferStrategy: ['low', 'medium', 'high', 'ultra'],
  homeBannerHeightScale: ['1', '1.5', '2'],
  doubanDataSource: [
    'direct',
    'cors-proxy-zwei',
    'cmliussss-cdn-tencent',
    'cmliussss-cdn-ali',
    'custom',
  ],
  doubanDataSourceBackup: [
    'direct',
    'cors-proxy-zwei',
    'cmliussss-cdn-tencent',
    'cmliussss-cdn-ali',
    'custom',
  ],
  doubanImageProxyType: [
    'server',
    'cmliussss-cdn-tencent',
    'cmliussss-cdn-ali',
    'custom',
    'direct',
    'img3',
  ],
  doubanImageProxyTypeBackup: [
    'server',
    'cmliussss-cdn-tencent',
    'cmliussss-cdn-ali',
    'custom',
    'direct',
    'img3',
  ],
  animeDataSource: ['direct', 'server-proxy', 'sakura', 'custom-baseurl'],
  animeDataSourceBackup: ['direct', 'server-proxy', 'sakura', 'custom-baseurl'],
};
const numericRanges: Partial<Record<LocalSettingKey, [number, number]>> = {
  speedTestTimeout: [4000, 30000],
  maxConcurrentDownloads: [1, 10],
  downloadThreadsPerTask: [1, 32],
  downloadSegmentTimeout: [30000, 300000],
  danmakuMaxCount: [0, 100000],
  quickForwardSeconds: [1, Number.MAX_SAFE_INTEGER],
  seekStepSeconds: [1, Number.MAX_SAFE_INTEGER],
};

export function normalizeLocalSetting<K extends LocalSettingKey>(
  key: K,
  value: unknown,
  defaults = getLocalSettingsDefaults()
): LocalSettings[K] {
  const fallback = defaults[key];
  if (key === 'homeModules') {
    if (!Array.isArray(value)) return fallback;
    const seen = new Set<string>();
    const modules: HomeModuleSetting[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue;
      const known = DEFAULT_HOME_MODULES.find(
        (module) => module.id === entry.id
      );
      if (!known || seen.has(known.id)) continue;
      seen.add(known.id);
      modules.push({
        ...known,
        enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
        order: Number.isFinite(entry.order) ? entry.order : modules.length,
      });
    }
    modules.sort((a, b) => a.order - b.order);
    for (const module of DEFAULT_HOME_MODULES)
      if (!seen.has(module.id)) modules.push({ ...module });
    return modules.map((module, order) => ({
      ...module,
      order,
    })) as LocalSettings[K];
  }
  if (typeof fallback === 'boolean')
    return (
      value === true || value === 'true'
        ? true
        : value === false || value === 'false'
        ? false
        : fallback
    ) as LocalSettings[K];
  if (typeof fallback === 'number') {
    const number =
      typeof value === 'string' && !value.trim() ? NaN : Number(value);
    const range = numericRanges[key];
    return (
      Number.isFinite(number) && range
        ? Math.min(range[1], Math.max(range[0], Math.round(number)))
        : fallback
    ) as LocalSettings[K];
  }
  if (typeof value !== 'string') return fallback;
  if (choices[key] && !choices[key]?.includes(value)) return fallback;
  if (
    key === 'downloadMode' &&
    value === 'filesystem' &&
    typeof window !== 'undefined' &&
    !('showDirectoryPicker' in window)
  )
    return 'browser' as LocalSettings[K];
  return value as LocalSettings[K];
}

export function readLocalSetting<K extends LocalSettingKey>(
  key: K
): LocalSettings[K] {
  const defaults = getLocalSettingsDefaults();
  try {
    if (typeof window === 'undefined') return defaults[key];
    const raw = localStorage.getItem(key);
    if (raw === null) return defaults[key];
    return normalizeLocalSetting(
      key,
      key === 'homeModules' ? JSON.parse(raw) : raw,
      defaults
    );
  } catch {
    return defaults[key];
  }
}

function serialize(value: LocalSettings[LocalSettingKey]): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function notifyLocalSettingsChanged(keys: readonly string[]) {
  if (typeof window === 'undefined' || keys.length === 0) return;
  window.dispatchEvent(
    new CustomEvent(LOCAL_SETTINGS_CHANGED, { detail: { keys } })
  );
  if (keys.some((key) => key.startsWith('home') || key === 'enableTrailers'))
    window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
  if (keys.includes('liveAutoSpeedTest'))
    window.dispatchEvent(
      new CustomEvent('liveAutoSpeedTestChanged', {
        detail: { enabled: readLocalSetting('liveAutoSpeedTest') },
      })
    );
}

export function writeLocalSetting<K extends LocalSettingKey>(
  key: K,
  value: LocalSettings[K]
): boolean {
  try {
    localStorage.setItem(key, serialize(normalizeLocalSetting(key, value)));
    notifyLocalSettingsChanged([key]);
    return true;
  } catch {
    return false;
  }
}

export function resetLocalSettings(): void {
  const defaults = getLocalSettingsDefaults();
  for (const key of Object.keys(defaults) as LocalSettingKey[])
    localStorage.removeItem(key);
  notifyLocalSettingsChanged(Object.keys(defaults));
}

export function snapshotLocalSettings(): Record<string, string> {
  const data: Record<string, string> = {};
  const defaults = getLocalSettingsDefaults();
  for (const key of LOCAL_SETTINGS_KEYS) {
    if (key in defaults && localStorage.getItem(key) !== null)
      data[key] = serialize(readLocalSetting(key as LocalSettingKey));
  }
  return data;
}

export function applyLocalSettingsSnapshot(data: Record<string, string>): void {
  const defaults = getLocalSettingsDefaults();
  const normalized: Record<string, string> = {};
  // Validate the whole snapshot before changing storage; one malformed field must not abort halfway.
  for (const key of LOCAL_SETTINGS_KEYS) {
    if (!(key in defaults) || !Object.prototype.hasOwnProperty.call(data, key))
      continue;
    let value: unknown = data[key];
    if (key === 'homeModules') {
      try {
        value = JSON.parse(data[key]);
      } catch {
        value = defaults.homeModules;
      }
    }
    normalized[key] = serialize(
      normalizeLocalSetting(key as LocalSettingKey, value, defaults)
    );
  }
  for (const key of LOCAL_SETTINGS_KEYS) {
    if (!(key in defaults)) continue;
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      localStorage.setItem(key, normalized[key]);
    } else localStorage.removeItem(key);
  }
  notifyLocalSettingsChanged(LOCAL_SETTINGS_KEYS);
}
