type AccentPair = readonly [primary: string, hover: string];

export const THEME_STYLESHEET_REVISION = 'native-3';

// 内置主题只提供颜色角色，不通过类名子串重写播放器、封面或独立模块。
function paletteCSS(selector: string, [primary, hover]: AccentPair, dark: boolean): string {
  const page = dark ? '#0d161a' : '#f4f3ee';
  const surface = dark ? '#1d2d33' : '#fffcf5';
  return `
${selector} {
  --ptv-accent: ${primary};
  --ptv-action: ${primary};
  --ptv-action-hover: ${hover};
  --ptv-action-ink: ${dark ? '#101820' : '#ffffff'};
  --ptv-page: color-mix(in srgb, ${page} 97%, ${primary});
  --ptv-panel: color-mix(in srgb, ${dark ? '#162329' : '#fffcf5'} 97%, ${primary});
  --ptv-surface: color-mix(in srgb, ${surface} 97%, ${primary});
  --ptv-soft: color-mix(in srgb, ${dark ? '#24363c' : '#e9eeea'} 94%, ${primary});
  --ptv-text: ${dark ? '#e8eeeb' : '#1c2b30'};
  --ptv-muted: ${dark ? '#a5b7ba' : '#53646b'};
  --ptv-line: color-mix(in srgb, ${dark ? '#2b3b40' : '#d4dcd7'} 95%, ${primary});
  --ptv-selected: color-mix(in srgb, ${page} ${dark ? '78%' : '88%'}, ${primary});
}
`;
}

function createTheme(
  name: string,
  description: string,
  color: string,
  light: AccentPair,
  dark: AccentPair
) {
  return {
    name,
    description,
    color,
    css:
      paletteCSS(':root[data-moontvplus]:not(.dark)', light, false) +
      paletteCSS(':root[data-moontvplus].dark', dark, true),
  };
}

export const builtInThemes = {
  default: {
    name: '默认主题',
    description: '使用 Apex TV 默认配色',
    color: '#006f68',
    css: '',
  },
  dark_blue: createTheme(
    '深蓝夜空', '深邃的蓝色科技风格', '#3b82f6',
    ['#1d4ed8', '#1e40af'], ['#93c5fd', '#bfdbfe']
  ),
  purple_dream: createTheme(
    '紫色梦境', '神秘的紫色渐变风格', '#a78bfa',
    ['#6d28d9', '#5b21b6'], ['#c4b5fd', '#ddd6fe']
  ),
  green_forest: createTheme(
    '翠绿森林', '清新的绿色自然风格', '#10b981',
    ['#047857', '#065f46'], ['#6ee7b7', '#a7f3d0']
  ),
  orange_sunset: createTheme(
    '橙色日落', '温暖的橙色日落风格', '#f97316',
    ['#c2410c', '#9a3412'], ['#fdba74', '#fed7aa']
  ),
  pink_candy: createTheme(
    '粉色糖果', '甜美的粉色糖果风格', '#ec4899',
    ['#be185d', '#9d174d'], ['#f9a8d4', '#fbcfe8']
  ),
  cyan_ocean: createTheme(
    '青色海洋', '清爽的青色海洋风格', '#06b6d4',
    ['#0e7490', '#155e75'], ['#67e8f9', '#a5f3fc']
  ),
};

export type ThemeName = keyof typeof builtInThemes;

export function getThemeCSS(themeName: ThemeName): string {
  return builtInThemes[themeName]?.css || '';
}

export function getThemeNames(): { value: ThemeName; label: string }[] {
  return Object.entries(builtInThemes).map(([key, theme]) => ({
    value: key as ThemeName,
    label: theme.name,
  }));
}
