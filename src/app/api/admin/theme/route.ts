/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { isCustomCSSEnabled } from '@/styles/themes';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    const {
      enableBuiltInTheme,
      enableCustomCSS,
      customCSS,
      enableCache,
      cacheMinutes,
      loginBackgroundImage,
      registerBackgroundImage,
      homeBackgroundImage,
      progressThumbType,
      progressThumbPresetId,
      progressThumbCustomUrl,
      loadingStyle,
      rateBadgeStyle,
    } = body as {
      enableBuiltInTheme?: boolean;
      enableCustomCSS?: boolean;
      customCSS: string;
      enableCache: boolean;
      cacheMinutes: number;
      loginBackgroundImage?: string;
      registerBackgroundImage?: string;
      homeBackgroundImage?: string;
      progressThumbType?: 'default' | 'preset' | 'custom';
      progressThumbPresetId?: string;
      progressThumbCustomUrl?: string;
      loadingStyle?: 'classic' | 'grid' | 'talisman' | 'race-lights' | 'race-car';
      rateBadgeStyle?: 'default' | 'flag' | 'medal';
    };

    // 参数校验
    if (
      (enableBuiltInTheme !== undefined && typeof enableBuiltInTheme !== 'boolean') ||
      (enableCustomCSS !== undefined && typeof enableCustomCSS !== 'boolean') ||
      typeof customCSS !== 'string' ||
      typeof enableCache !== 'boolean' ||
      typeof cacheMinutes !== 'number'
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 验证背景图URL格式（支持多行，每行一个URL）
    if (loginBackgroundImage && loginBackgroundImage.trim() !== '') {
      const urls = loginBackgroundImage
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url !== '');

      for (const url of urls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return NextResponse.json(
            { error: `登录界面背景图URL格式错误：${url}，每个URL必须以http://或https://开头` },
            { status: 400 }
          );
        }
      }
    }

    if (registerBackgroundImage && registerBackgroundImage.trim() !== '') {
      const urls = registerBackgroundImage
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url !== '');

      for (const url of urls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return NextResponse.json(
            { error: `注册界面背景图URL格式错误：${url}，每个URL必须以http://或https://开头` },
            { status: 400 }
          );
        }
      }
    }

    if (homeBackgroundImage && homeBackgroundImage.trim() !== '') {
      const urls = homeBackgroundImage
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url !== '');

      for (const url of urls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return NextResponse.json(
            { error: `首页背景图URL格式错误：${url}，每个URL必须以http://或https://开头` },
            { status: 400 }
          );
        }
      }
    }

    const adminConfig = await getConfig();

    // 权限校验 - 使用v2用户系统
    if (username !== process.env.USERNAME) {
      const userInfo = await db.getUserInfoV2(username);
      if (!userInfo || userInfo.role !== 'admin' || userInfo.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 获取当前版本号，如果CSS有变化则递增
    const currentVersion = adminConfig.ThemeConfig?.cacheVersion || 0;
    const currentEnabled = isCustomCSSEnabled(adminConfig.ThemeConfig);
    const nextEnabled =
      typeof enableCustomCSS === 'boolean'
        ? enableCustomCSS
        : typeof enableBuiltInTheme === 'boolean'
          ? isCustomCSSEnabled({ enableBuiltInTheme, customCSS })
          : currentEnabled;
    const currentCSS = currentEnabled ? adminConfig.ThemeConfig?.customCSS || '' : '';
    const newCSS = nextEnabled ? customCSS : '';
    const cssChanged = currentCSS !== newCSS || currentEnabled !== nextEnabled;

    // 更新主题配置
    adminConfig.ThemeConfig = {
      // 旧配色值统一归为默认；是否叠加 CSS 由新开关独立控制。
      enableBuiltInTheme: true,
      builtInTheme: 'default',
      enableCustomCSS: nextEnabled,
      customCSS,
      enableCache,
      cacheMinutes,
      cacheVersion: cssChanged ? currentVersion + 1 : currentVersion,
      loginBackgroundImage: loginBackgroundImage?.trim() || undefined,
      registerBackgroundImage: registerBackgroundImage?.trim() || undefined,
      homeBackgroundImage: homeBackgroundImage?.trim() || undefined,
      progressThumbType: progressThumbType || 'default',
      progressThumbPresetId: progressThumbPresetId?.trim() || undefined,
      progressThumbCustomUrl: progressThumbCustomUrl?.trim() || undefined,
      loadingStyle:
        loadingStyle === 'classic' ||
        loadingStyle === 'grid' ||
        loadingStyle === 'race-lights' ||
        loadingStyle === 'race-car' ||
        loadingStyle === 'talisman'
          ? loadingStyle
          : 'race-lights',
      rateBadgeStyle:
        rateBadgeStyle === 'default' ||
        rateBadgeStyle === 'flag' ||
        rateBadgeStyle === 'medal'
          ? rateBadgeStyle
          : 'flag',
    };

    // 写入数据库
    await db.saveAdminConfig(adminConfig);

    return NextResponse.json(
      {
        ok: true,
        cacheVersion: adminConfig.ThemeConfig.cacheVersion,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('更新主题配置失败:', error);
    return NextResponse.json(
      {
        error: '更新主题配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
