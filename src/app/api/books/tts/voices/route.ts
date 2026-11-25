import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import { getBookTtsConfig, listBookTtsVoices } from '@/lib/book-tts';

import { getAuthorizedBooksUsername } from '../../_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const config = await getBookTtsConfig();
    const voices = await listBookTtsVoices();
    return NextResponse.json({
      voices,
      defaults: {
        voice: config.defaultVoice,
        rate: config.defaultRate,
        pitch: config.defaultPitch,
        volume: config.defaultVolume,
        maxCharsPerChunk: config.maxCharsPerChunk,
        prefetchChunks: config.prefetchChunks,
        maxTextLengthPerRequest: config.maxTextLengthPerRequest,
      },
    });
  } catch (error) {
    return NextResponse.json((({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '获取朗读音色')), { status: 500 });
  }
}
