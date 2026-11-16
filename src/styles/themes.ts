export const THEME_STYLESHEET_REVISION = 'native-4';

/** 新配置使用独立开关；旧配置仅继承原来已启用的自定义 CSS。 */
export function isCustomCSSEnabled(config?: {
  enableCustomCSS?: boolean;
  enableBuiltInTheme?: boolean;
  customCSS?: string;
}): boolean {
  if (typeof config?.enableCustomCSS === 'boolean') {
    return config.enableCustomCSS;
  }
  return config?.enableBuiltInTheme === false && !!config.customCSS?.trim();
}
