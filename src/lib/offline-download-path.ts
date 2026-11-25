import * as fs from 'fs';
import * as path from 'path';

export class OfflineDownloadPathError extends Error {
  constructor() {
    super('非法下载路径或集数');
    this.name = 'OfflineDownloadPathError';
  }
}

function isOutside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
}

// 校验规范化路径及已有父目录的真实路径，防止目录前缀和符号链接绕过。
export function assertOfflineDownloadPath(baseDir: string, targetPath: string): string {
  const root = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  if (target.includes('\0') || path.relative(root, target) === '' || isOutside(root, target)) {
    throw new OfflineDownloadPathError();
  }

  if (fs.existsSync(root)) {
    let ancestor = target;
    while (true) {
      try {
        fs.lstatSync(ancestor);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw new OfflineDownloadPathError();
        ancestor = parent;
      }
    }
    let realAncestor: string;
    try {
      realAncestor = fs.realpathSync(ancestor);
    } catch {
      throw new OfflineDownloadPathError();
    }
    if (isOutside(fs.realpathSync(root), realAncestor)) throw new OfflineDownloadPathError();
  }
  return target;
}

export function resolveOfflineDownloadDirectory(
  baseDir: string, source: string, videoId: string, episodeIndex: number
): string {
  if (typeof source !== 'string' || !source.trim() || source.includes('\0') ||
      typeof videoId !== 'string' || !videoId.trim() || videoId.includes('\0') ||
      !Number.isSafeInteger(episodeIndex) || episodeIndex < 0 || episodeIndex >= Number.MAX_SAFE_INTEGER) {
    throw new OfflineDownloadPathError();
  }
  return assertOfflineDownloadPath(baseDir, path.resolve(baseDir, source, videoId, `ep${episodeIndex + 1}`));
}

export function resolveOfflineDownloadFile(baseDir: string, downloadDir: string, filename: string): string {
  const directory = assertOfflineDownloadPath(baseDir, downloadDir);
  return assertOfflineDownloadPath(directory, path.resolve(directory, filename));
}
