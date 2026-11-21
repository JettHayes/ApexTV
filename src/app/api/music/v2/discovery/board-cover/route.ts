import { NextRequest, NextResponse } from 'next/server';

import {
  isMusicSource,
  lxGetJson,
  normalizeLxSong,
  unwrapLxArray,
} from '@/lib/music-v2';
import { badRequest } from '@/lib/music-v2-api';
import { normalizeBoardCover } from '@/lib/music/board-covers.server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const source = params.get('source');
  const boardId = params.get('boardId') || '';
  if (!isMusicSource(source)) return badRequest('不支持的音源');
  if (!boardId || boardId.length > 200) return badRequest('无效的榜单 ID');

  try {
    const payload = await lxGetJson<unknown>(
      '/api/music/leaderboard/list?source=' +
        source +
        '&bangid=' +
        encodeURIComponent(boardId) +
        '&page=1',
      'none',
      AbortSignal.timeout(8000)
    );
    const cover =
      unwrapLxArray<Parameters<typeof normalizeLxSong>[0]>(payload)
        .map(normalizeLxSong)
        .find(
          (song) =>
            typeof song.cover === 'string' && /^https?:\/\//.test(song.cover)
        )?.cover || '';
    return NextResponse.json({
      success: true,
      data: { cover: normalizeBoardCover(cover) },
    });
  } catch {
    return NextResponse.json(
      { success: false, data: { cover: '' } },
      { status: 502 }
    );
  }
}
