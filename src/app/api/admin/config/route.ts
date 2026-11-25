import { appErrorPayload, reportAppError } from '@/lib/app-error';
/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AdminConfigResult } from '@/lib/admin.types';
import { adminConfigVersion } from '@/lib/admin-config-version';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    const config = await getConfig();
    const result: AdminConfigResult = {
      Role: 'owner',
      Config: config,
      Revision: adminConfigVersion(config),
    };
    if (username === process.env.USERNAME) {
      result.Role = 'owner';
    } else {
      // 从新版数据库获取用户信息
      const { db } = await import('@/lib/db');
      const userInfoV2 = await db.getUserInfoV2(username);

      if (userInfoV2 && userInfoV2.role === 'admin' && !userInfoV2.banned) {
        result.Role = 'admin';
      } else {
        return NextResponse.json(
          { error: '你是管理员吗你就访问？' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store', // 管理员配置不缓存
      },
    });
  } catch (error) {
    reportAppError(error, "获取管理员配置失败");
    return NextResponse.json(
      {...{
        error: '获取管理员配置失败',
        details: (error as Error).message,
      }, ...appErrorPayload(error, "后台配置服务", 500)},
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '不支持本地存储进行管理员配置' },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    const newConfig = await request.json();
    const revision = request.headers.get('if-match')?.replace(/^"|"$/g, '');
    if (!revision) return NextResponse.json({ error: '页面配置版本已过期，请刷新后重新保存' }, { status: 428 });

    // 权限检查
    if (username !== process.env.USERNAME) {
      const { db } = await import('@/lib/db');
      const userInfoV2 = await db.getUserInfoV2(username);

      if (!userInfoV2 || (userInfoV2.role !== 'admin' && userInfoV2.role !== 'owner') || userInfoV2.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 保存配置
    const { db } = await import('@/lib/db');
    const { configSelfCheck } = await import('@/lib/config');

    // 自检配置
    const checkedConfig = configSelfCheck(newConfig);

    await db.updateAdminConfig((latest) => {
      if (adminConfigVersion(configSelfCheck(structuredClone(latest))) !== revision) throw new Error('CONFIG_VERSION_CONFLICT');
      for (const key of Object.keys(latest)) delete (latest as any)[key];
      Object.assign(latest, checkedConfig);
    });

    return NextResponse.json({ success: true, message: '配置已保存' });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFIG_VERSION_CONFLICT') return NextResponse.json({ error: '配置已被其他操作修改，请刷新后重新保存' }, { status: 409 });
    reportAppError(error, "保存配置失败");
    return NextResponse.json(
      {...{ error: '保存配置失败: ' + (error as Error).message }, ...appErrorPayload(error, "后台配置服务", 500)},
      { status: 500 }
    );
  }
}
