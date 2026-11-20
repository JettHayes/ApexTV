import type { BookSource } from './book.types';

export interface BookSourceOption {
  id: string;
  name: string;
  label: string;
  originalName: string;
  hostname: string;
  searchText: string;
}

// Presentation only: never use a shortened name to identify or exclude a source.
function compactSourceName(original: string): string {
  let name = Array.from(original)
    .filter((character) => {
      const code = character.codePointAt(0) || 0;
      return (
        !(code >= 0x1f000 && code <= 0x1faff) &&
        !(code >= 0x2600 && code <= 0x27bf) &&
        ![0xfe0e, 0xfe0f, 0x200d].includes(code)
      );
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  const shelfNote = name.search(/[·・｜|]\s*书架.*(?:加入书架|阅读登录)/);
  if (shelfNote > 0) name = name.slice(0, shelfNote).trim() + ' · 书架源';
  else {
    const note = name.search(
      /(?:加入书架|阅读登录|全部加入书架|换源QQ浏览器|使用教程|操作教程|使用说明|更新说明|交流群|QQ群号?|https?:\/\/)/i
    );
    if (note > 1) name = name.slice(0, note);
  }
  name = name
    .replace(/[（(](?:修复|说明|教程|更新日期|更新于)[^）)]*[）)]/g, '')
    .replace(/[\s·・｜|:：\-—]+$/g, '')
    .trim();
  if (!name) name = original.trim() || '未命名书源';
  const characters = Array.from(name);
  return characters.length > 28 ? characters.slice(0, 28).join('') + '…' : name;
}

export function buildBookSourceOptions(
  sources: BookSource[]
): BookSourceOption[] {
  const options = sources.map((source) => {
    const originalName = source.name || '未命名书源';
    const name = compactSourceName(originalName);
    let hostname = '';
    try {
      hostname = new URL(source.url).hostname.replace(/^www\./i, '');
    } catch {
      /* Some Legado source keys are names rather than URLs. */
    }
    return {
      id: source.id,
      name,
      label: name,
      originalName,
      hostname,
      searchText: [originalName, name, hostname].join(' ').toLowerCase(),
    };
  });
  const nameCounts = new Map<string, number>();
  const siteCounts = new Map<string, number>();
  for (const option of options) {
    nameCounts.set(option.name, (nameCounts.get(option.name) || 0) + 1);
    const key = option.name + '|' + option.hostname;
    siteCounts.set(key, (siteCounts.get(key) || 0) + 1);
  }
  const ordinals = new Map<string, number>();
  return options.map((option) => {
    if ((nameCounts.get(option.name) || 0) <= 1) return option;
    const key = option.name + '|' + option.hostname;
    const ordinal = (ordinals.get(key) || 0) + 1;
    ordinals.set(key, ordinal);
    const sameSite = (siteCounts.get(key) || 0) > 1;
    return {
      ...option,
      label: [option.name, option.hostname, sameSite ? '来源 ' + ordinal : '']
        .filter(Boolean)
        .join(' · '),
    };
  });
}

export function filterBookSourceOptions(
  options: BookSourceOption[],
  keyword: string
) {
  const query = keyword.trim().toLowerCase();
  return query
    ? options.filter((option) => option.searchText.includes(query))
    : options;
}
