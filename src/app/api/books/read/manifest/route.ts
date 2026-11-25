import { NextRequest, NextResponse } from 'next/server';

import { reportAppError } from '@/lib/app-error';
import { BookAcquisitionLink } from '@/lib/book.types';
import { bookProvider } from '@/lib/book-provider';
import {
  BookRuleParseError,
  BookSourceRequestError,
} from '@/lib/book-source-error';
import { db } from '@/lib/db';

import { getAuthorizedBooksUsername } from '../../_utils';

export const runtime = 'nodejs';

type ManifestPayload = {
  sourceId?: string;
  bookId?: string;
  href?: string;
  acquisitionHref?: string;
  format?: 'epub' | 'pdf' | 'chapters' | null;
  title?: string;
  author?: string;
  cover?: string;
  summary?: string;
};

async function resolveManifest(username: string, payload: ManifestPayload) {
  try {
    const sourceId = payload.sourceId?.trim();
    const href = payload.href?.trim();
    const acquisitionHref = payload.acquisitionHref?.trim();
    const format = payload.format;
    const bookId = payload.bookId?.trim();

    if (!sourceId) {
      return NextResponse.json({ error: '缺少 sourceId' }, { status: 400 });
    }

    const existingRecord = bookId
      ? await db.getBookReadRecord(username, sourceId, bookId)
      : null;
    const shelfItem = bookId
      ? await db.getBookShelf(username, sourceId, bookId)
      : null;
    const resolvedHref =
      href ||
      existingRecord?.detailHref ||
      shelfItem?.detailHref ||
      (bookId && /^https?:\/\//i.test(bookId) ? bookId : '');
    const resolvedAcquisitionHref =
      acquisitionHref ||
      existingRecord?.acquisitionHref ||
      shelfItem?.acquisitionHref ||
      '';
    const resolvedFormat =
      format || existingRecord?.format || shelfItem?.format || 'epub';

    if (!resolvedHref && !resolvedAcquisitionHref) {
      return NextResponse.json(
        {
          error:
            '缺少 href / acquisitionHref，且历史记录中也没有可恢复的下载链接',
        },
        { status: 400 }
      );
    }

    const fallbackAcquisitionLinks: BookAcquisitionLink[] =
      resolvedAcquisitionHref
        ? [
            {
              rel: 'http://opds-spec.org/acquisition',
              type:
                resolvedFormat === 'chapters'
                  ? 'application/x-legado-chapters+json'
                  : resolvedFormat === 'pdf'
                  ? 'application/pdf'
                  : 'application/epub+zip',
              href: resolvedAcquisitionHref,
            },
          ]
        : [];

    const detail = await bookProvider.getBookDetail(
      sourceId,
      resolvedHref || '',
      {
        id: bookId || resolvedAcquisitionHref || undefined,
        title:
          payload.title ||
          existingRecord?.title ||
          shelfItem?.title ||
          undefined,
        author:
          payload.author ||
          existingRecord?.author ||
          shelfItem?.author ||
          undefined,
        cover:
          payload.cover ||
          existingRecord?.cover ||
          shelfItem?.cover ||
          undefined,
        summary: payload.summary || undefined,
        detailHref: resolvedHref || undefined,
        acquisitionLinks: fallbackAcquisitionLinks,
      }
    );
    if (detail.readingUnavailableReason)
      throw new BookRuleParseError(detail.readingUnavailableReason);
    const preferred = resolvedHref
      ? await bookProvider.getPreferredAcquisition(sourceId, resolvedHref)
      : {
          format:
            resolvedFormat === 'chapters'
              ? 'chapters'
              : resolvedFormat === 'pdf'
              ? 'pdf'
              : 'epub',
          href: resolvedAcquisitionHref || '',
        };
    const lastRecord = await db.getBookReadRecord(
      username,
      sourceId,
      detail.id
    );

    return NextResponse.json({
      book: detail,
      format: preferred.format,
      fileUrl:
        preferred.format === 'chapters'
          ? undefined
          : `/api/books/file?sourceId=${encodeURIComponent(
              sourceId
            )}&bookId=${encodeURIComponent(
              detail.id
            )}&format=${encodeURIComponent(preferred.format)}`,
      chaptersUrl:
        preferred.format === 'chapters'
          ? `/api/books/read/chapters?sourceId=${encodeURIComponent(
              sourceId
            )}&href=${encodeURIComponent(preferred.href)}`
          : undefined,
      acquisitionHref: preferred.href,
      cacheKey: `${sourceId}::${detail.id}::${preferred.format}`,
      coverUrl: detail.cover,
      lastRecord,
    });
  } catch (error) {
    return NextResponse.json(
      (({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '电子书服务')),
      {
        status:
          error instanceof BookRuleParseError
            ? 422
            : error instanceof BookSourceRequestError
            ? 502
            : 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  const { searchParams } = new URL(request.url);
  return resolveManifest(username, {
    sourceId: searchParams.get('sourceId') || undefined,
    bookId: searchParams.get('bookId') || undefined,
  });
}

export async function POST(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const payload = (await request.json()) as ManifestPayload;
    return await resolveManifest(username, payload);
  } catch (error) {
    return NextResponse.json(
      (({ code, message, status, upstreamStatus }) => ({ error: message, code, status, upstreamStatus }))(reportAppError(error, '电子书服务')),
      { status: 500 }
    );
  }
}
