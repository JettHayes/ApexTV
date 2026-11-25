import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import {
  getNativeBoardCovers,
  normalizeBoardCover,
} from '@/lib/music/board-covers.server';
import { isMusicSource, lxGetJson, unwrapLxArray } from '@/lib/music-v2';
import { badRequest, internalError } from '@/lib/music-v2-api';

export const runtime = 'nodejs';

type Board = {
  id?: string;
  bangid?: string;
  name: string;
  img?: string;
  cover?: string;
  pic?: string;
  coverImgUrl?: string;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'kw';
    if (!isMusicSource(source)) return badRequest('不支持的音源');

    const fallbackSources = [source, 'kg', 'kw', 'tx', 'wy', 'mg'].filter(
      (item, index, arr) => arr.indexOf(item) === index
    );

    let actualSource = source as typeof source;
    let list: Board[] = [];
    const errors: string[] = [];
    let lastError: unknown;

    for (const candidate of fallbackSources) {
      try {
        const candidatePayload = await lxGetJson<any>(
          `/api/music/leaderboard/boards?source=${candidate}`,
          'none'
        );
        const candidateList = unwrapLxArray<Board>(candidatePayload);
        if (Array.isArray(candidateList) && candidateList.length > 0) {
          actualSource = candidate as typeof source;
          list = candidateList;
          break;
        }
      } catch (error) {
        errors.push(candidate);
        lastError = error;
        reportAppError(error, '获取榜单源');
      }
    }

    if (list.length === 0 && errors.length === fallbackSources.length) {
      return internalError('所有榜单音源均获取失败，请稍后重试', lastError);
    }

    const covers = list.some(
      (item) => !(item.img || item.cover || item.pic || item.coverImgUrl)
    )
      ? await getNativeBoardCovers(
          actualSource as Parameters<typeof getNativeBoardCovers>[0]
        )
      : new Map<string, string>();

    return NextResponse.json({
      success: true,
      data: {
        list: list.map((item) => ({
          id: item.bangid || item.id || '',
          name: item.name,
          cover: normalizeBoardCover(
            item.img ||
              item.cover ||
              item.pic ||
              item.coverImgUrl ||
              covers.get(String(item.bangid || item.id))
          ),
          source: actualSource,
        })),
        source: actualSource,
        errors,
      },
    });
  } catch (error) {
    reportAppError(error, '获取榜单');
    return internalError('获取榜单失败', error);
  }
}
