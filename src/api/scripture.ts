import { api } from './client';

/**
 * Scripture references + verse fetching, talking to the NestJS scripture module
 * (POST /scripture/parse, GET /scripture/verse, GET /scripture/translations).
 *
 * Parsing is also mirrored locally (parseScriptureLocal) so the composer chip
 * can react instantly while typing without a round-trip. The server stays
 * authoritative for what's persisted on a post.
 */

export interface ScriptureMention {
  reference: string;
  book: string; // USFM, e.g. "JHN"
  bookName: string; // "John"
  chapter: number;
  verse: number;
  verseEnd: number;
  startIndex: number;
  endIndex: number;
}

export interface VerseResult {
  reference: string;
  translation: string;
  book: string;
  bookName: string;
  chapter: number;
  verse: number;
  verseEnd: number;
  text: string;
}

export interface BibleTranslation {
  id: string;
  name: string;
  englishName: string;
  shortName?: string;
  language: string;
}

// The poster's default version when none is chosen.
export const DEFAULT_TRANSLATION = 'BSB';

/**
 * Build a YouVersion bible.com URL for a reference. This is a universal link:
 * it opens the YouVersion app if installed, otherwise the verse on the web.
 * Sharing it (native share sheet) lets the user route it to whichever Bible app
 * (or any app) they choose — no OS-level "Bible apps" picker exists, so the
 * share sheet IS the native picker. USFM book codes (JHN, 1CO) match YouVersion.
 */
export function bibleAppUrl(m: {
  book: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
}): string {
  const range = m.verseEnd && m.verseEnd > m.verse ? `${m.verse}-${m.verseEnd}` : `${m.verse}`;
  // e.g. https://www.bible.com/bible/59/JHN.3.16  (59 = ESV; YouVersion resolves
  // the book.chapter.verse path regardless and lets the user pick their version)
  return `https://www.bible.com/bible/1/${m.book}.${m.chapter}.${range}`;
}

// ---- Lightweight client-side detection (for the live composer chip) ----
// A deliberately simple regex: <Book> <chapter>:<verse>[-<end>]. It's only used
// to decide whether to SHOW the chip; the server does the authoritative parse.
// Keep this list short but cover the common books; full validation is server-side.
const BOOK_PATTERN =
  '(?:(?:1|2|3|i{1,3})\\s*)?[A-Z][a-z]+(?:\\s[A-Z][a-z]+)?';
const LOCAL_REF_REGEX = new RegExp(
  `\\b${BOOK_PATTERN}\\.?\\s+\\d{1,3}\\s*[:.]\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?`,
  'g',
);

/** True if the text plausibly contains a scripture reference (chip trigger). */
export function hasLikelyScripture(text: string): boolean {
  if (!text) return false;
  LOCAL_REF_REGEX.lastIndex = 0;
  return LOCAL_REF_REGEX.test(text);
}

/** Authoritative parse via the API (used to confirm + get index ranges). */
export async function parseScripture(
  text: string,
  translation?: string,
): Promise<ScriptureMention[]> {
  try {
    const res = await api.post<{ mentions: ScriptureMention[] }>(
      'scripture/parse',
      { text, translation },
    );
    return res?.mentions ?? [];
  } catch {
    return [];
  }
}

/** Fetch a verse's text in a given translation (cached server-side). */
export async function fetchVerse(
  m: Pick<ScriptureMention, 'book' | 'chapter' | 'verse' | 'verseEnd'>,
  translation: string = DEFAULT_TRANSLATION,
): Promise<VerseResult> {
  const query: Record<string, string | number> = {
    book: m.book,
    chapter: m.chapter,
    verse: m.verse,
    translation,
  };
  if (m.verseEnd && m.verseEnd > m.verse) query.verseEnd = m.verseEnd;
  return api.get<VerseResult>('scripture/verse', query);
}

let translationsCache: BibleTranslation[] | null = null;
export async function fetchTranslations(): Promise<BibleTranslation[]> {
  if (translationsCache) return translationsCache;
  try {
    const list = await api.get<BibleTranslation[]>('scripture/translations');
    translationsCache = Array.isArray(list) ? list : [];
    return translationsCache;
  } catch {
    return [];
  }
}
