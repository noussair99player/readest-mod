import { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import type { Book } from '@/types/book';
import { DocumentLoader } from '@/libs/document';
import type { ClosableFile } from '@/utils/file';
import { getBookPageCount } from '@/utils/book';
import { StatisticsDb } from '@/services/statistics/statisticsDb';

/** Total seconds read in a book, from its reading statistics. 0 until loaded. */
export const useBookReadingSeconds = (book: Book): number => {
  const { appService } = useEnv();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!appService) return;
    let cancelled = false;
    const load = async () => {
      const db = await StatisticsDb.open(appService);
      const summary = await db.getBookReadingSummary(book.hash);
      if (!cancelled) setSeconds(summary.seconds);
    };
    // Statistics are best-effort: never surface a failed read as an unhandled rejection.
    void load().catch((err) => console.warn('[stats] book reading time failed:', err));
    return () => {
      cancelled = true;
    };
    // updatedAt changes as reading progress is saved, so the label follows along.
  }, [appService, book.hash, book.updatedAt]);

  return seconds;
};

export interface BookReadingStats {
  seconds: number;
  pagesPerHour: number | null;
  /** Estimated from the table of contents: chapters per page x pages per hour. */
  chaptersPerHour: number | null;
}

// Below this, a per-hour rate is mostly noise.
const MIN_SECONDS_FOR_RATES = 60;

const countTopLevelChapters = async (
  appService: NonNullable<ReturnType<typeof useEnv>['appService']>,
  book: Book,
): Promise<number> => {
  const { file } = await appService.loadBookContent(book);
  let bookDoc: Awaited<ReturnType<DocumentLoader['open']>>['book'] | undefined;
  try {
    bookDoc = (await new DocumentLoader(file).open()).book;
    return bookDoc.toc?.length ?? 0;
  } finally {
    try {
      await bookDoc?.destroy?.();
    } catch {}
    const closable = file as ClosableFile;
    if (closable && closable.close) await closable.close();
  }
};

/** Reading time plus pages/hour and chapters/hour for the book details page. */
export const useBookReadingStats = (book: Book): BookReadingStats | null => {
  const { appService } = useEnv();
  const [stats, setStats] = useState<BookReadingStats | null>(null);

  useEffect(() => {
    if (!appService) return;
    let cancelled = false;
    const load = async () => {
      const db = await StatisticsDb.open(appService);
      const { seconds, pages } = await db.getBookReadingSummary(book.hash);
      const hours = seconds / 3600;
      const hasRates = seconds >= MIN_SECONDS_FOR_RATES && pages > 0;
      const pagesPerHour = hasRates ? pages / hours : null;
      if (!cancelled) setStats({ seconds, pagesPerHour, chaptersPerHour: null });

      const totalPages = getBookPageCount(book);
      if (!hasRates || !totalPages || !book.downloadedAt) return;
      const chapters = await countTopLevelChapters(appService, book);
      if (cancelled || !chapters) return;
      setStats({
        seconds,
        pagesPerHour,
        chaptersPerHour: ((pages / totalPages) * chapters) / hours,
      });
    };
    void load().catch((err) => console.warn('[stats] book reading stats failed:', err));
    return () => {
      cancelled = true;
    };
  }, [appService, book]);

  return stats;
};
