import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  emptyPersonalLibrary,
  libraryKey,
  normalizeLibraryEntry,
  normalizeLibraryList,
} from '@/lib/personal-library';
import {
  personalLibraryNamespace,
  personalLibraryStorage,
} from '@/lib/personal-library.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function account(request: NextRequest) {
  const username = getAuthInfoFromCookie(request)?.username;
  if (!username) return null;
  if (username !== process.env.USERNAME) {
    const user = await db.getUserInfoV2(username);
    if (!user || user.banned) return null;
  }
  return username;
}
export async function GET(request: NextRequest) {
  try {
    const username = await account(request);
    if (!username)
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const values = await personalLibraryStorage().hGetAll(
      personalLibraryNamespace(username)
    );
    const result = emptyPersonalLibrary();
    for (const [key, value] of Object.entries(values || {})) {
      try {
        const raw = typeof value === 'string' ? JSON.parse(value) : value;
        if (key.startsWith('entry:')) {
          const entry = normalizeLibraryEntry(raw);
          if (entry) result.entries[libraryKey(entry)] = entry;
        } else if (key.startsWith('list:')) {
          const list = normalizeLibraryList(raw);
          if (list) result.lists.push(list);
        }
      } catch {
        /* 单条损坏数据不阻断其余片单。 */
      }
    }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: '个人内容加载失败，请稍后重试' },
      { status: 500 }
    );
  }
}
export async function PUT(request: NextRequest) {
  try {
    const username = await account(request);
    if (!username)
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 32 * 1024)
      return NextResponse.json({ error: '内容过长' }, { status: 413 });
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: '内容格式错误' }, { status: 400 });
    }
    const kind = body?.kind;
    const value =
      kind === 'entry'
        ? normalizeLibraryEntry(body.value)
        : kind === 'list'
        ? normalizeLibraryList(body.value)
        : null;
    if (!value)
      return NextResponse.json({ error: '内容格式错误' }, { status: 400 });
    value.updatedAt = Date.now();
    const field =
      kind === 'entry'
        ? 'entry:' +
          libraryKey(
            value as NonNullable<ReturnType<typeof normalizeLibraryEntry>>
          )
        : 'list:' + (value as { id: string }).id;
    await personalLibraryStorage().hSet(
      personalLibraryNamespace(username),
      field,
      JSON.stringify(value)
    );
    return NextResponse.json({ value });
  } catch {
    return NextResponse.json({ error: '保存失败，请重试' }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const username = await account(request);
    if (!username)
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const kind = request.nextUrl.searchParams.get('kind'),
      key = request.nextUrl.searchParams.get('key');
    if (!key || key.length > 2300 || (kind !== 'entry' && kind !== 'list'))
      return NextResponse.json({ error: '内容格式错误' }, { status: 400 });
    await personalLibraryStorage().hDel(
      personalLibraryNamespace(username),
      kind + ':' + key
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '移除失败，请重试' }, { status: 500 });
  }
}
