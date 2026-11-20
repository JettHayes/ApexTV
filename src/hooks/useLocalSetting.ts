'use client';

import { useEffect, useState } from 'react';

import {
  LOCAL_SETTINGS_CHANGED,
  LocalSettingKey,
  LocalSettings,
  readLocalSetting,
} from '@/lib/local-settings';

/** Only subscribe to the requested setting; unrelated switches do not rerender consumers. */
export function useLocalSetting<K extends LocalSettingKey>(
  key: K
): LocalSettings[K] {
  const [value, setValue] = useState<LocalSettings[K]>(() =>
    readLocalSetting(key)
  );
  useEffect(() => {
    const read = () => setValue(readLocalSetting(key));
    const changed = (event: Event) => {
      const keys = (event as CustomEvent<{ keys?: string[] }>).detail?.keys;
      if (!keys || keys.includes(key)) read();
    };
    const storage = (event: StorageEvent) => {
      if (!event.key || event.key === key) read();
    };
    read();
    window.addEventListener(LOCAL_SETTINGS_CHANGED, changed);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(LOCAL_SETTINGS_CHANGED, changed);
      window.removeEventListener('storage', storage);
    };
  }, [key]);
  return value;
}
