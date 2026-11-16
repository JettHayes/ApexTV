export const PROGRESS_THUMB_PRESETS = [
  {
    id: 'f1-car',
    name: 'F1 赛车',
    url: '/icons/racing/icons8-f1-car-64.png',
    monochrome: true,
  },
  {
    id: 'finish-flag',
    name: '方格旗',
    url: '/icons/racing/icons8-finish-flag-64.png',
    monochrome: true,
  },
  {
    id: 'racing-helmet',
    name: '赛车头盔',
    url: '/icons/racing/icons8-racing-helmet-64.png',
    monochrome: false,
  },
] as const;

export function getProgressThumbPreset(id?: string) {
  return PROGRESS_THUMB_PRESETS.find((preset) => preset.id === id) || PROGRESS_THUMB_PRESETS[0];
}
