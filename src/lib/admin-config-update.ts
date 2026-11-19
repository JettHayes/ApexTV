import type { AdminConfig } from './admin.types';

// Retry a conflicting read/modify/write without overwriting another request's changes.
export async function updateStoredAdminConfig(
  read: () => Promise<string | null>,
  compareAndSet: (expected: string, value: string) => Promise<boolean>,
  update: (config: AdminConfig) => void
): Promise<AdminConfig> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const original = await read();
    if (!original) throw new Error('配置不存在，请刷新页面');
    const config = JSON.parse(original) as AdminConfig;
    update(config);
    if (await compareAndSet(original, JSON.stringify(config))) return config;
  }
  throw new Error('配置正在被其他请求更新，请刷新后重试');
}
