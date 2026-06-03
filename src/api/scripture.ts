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
  key?: string;
  book: string; // USFM, e.g. "JHN"
  bookName: string; // "John"
  chapter: number;
  verse: number;
  verseEnd: number;
  startIndex: number;
  endIndex: number;
  shareCount?: number;
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
  numberOfBooks?: number;
}

export interface ScriptureShare extends VerseResult {
  key: string;
  shareCount?: number;
}

export interface BibleBook {
  usfm: string;
  name: string;
  aliases: string[];
}

// The poster's default version when none is chosen.
export const DEFAULT_TRANSLATION = 'eng_asv';

export const FALLBACK_TRANSLATIONS: BibleTranslation[] = [
  {
    id: 'eng_asv',
    name: 'American Standard Version (1901)',
    englishName: 'American Standard Version (1901)',
    shortName: 'ASV',
    language: 'eng',
    numberOfBooks: 66,
  },
  {
    id: 'BSB',
    name: 'Berean Standard Bible',
    englishName: 'Berean Standard Bible',
    shortName: 'BSB',
    language: 'eng',
    numberOfBooks: 66,
  },
  {
    id: 'ENGWEBP',
    name: 'World English Bible',
    englishName: 'World English Bible',
    shortName: 'WEB',
    language: 'eng',
    numberOfBooks: 66,
  },
];

export function translationLabel(translation: BibleTranslation): string {
  const shortName = translation.shortName?.trim();
  const fullName =
    translation.englishName?.trim() ||
    translation.name?.trim() ||
    translation.id;
  if (!shortName || shortName === fullName) return fullName;
  return `${shortName} - ${fullName}`;
}

export function cleanBibleTranslations(translations: BibleTranslation[]): BibleTranslation[] {
  const seen = new Set<string>();
  return translations
    .filter((translation) => {
      const language = translation.language.toLowerCase();
      const books = Number(translation.numberOfBooks);
      return language === 'eng' && books === 66;
    })
    .filter((translation) => {
      if (seen.has(translation.id)) return false;
      seen.add(translation.id);
      return true;
    })
    .sort((a, b) => translationLabel(a).localeCompare(translationLabel(b)));
}

export function bibleTranslationOptions(translations: BibleTranslation[]): BibleTranslation[] {
  const cleaned = cleanBibleTranslations(translations);
  return cleaned.length ? cleaned : FALLBACK_TRANSLATIONS;
}

export const BIBLE_BOOKS: BibleBook[] = [
  { usfm: 'GEN', name: 'Genesis', aliases: ['genesis', 'gen', 'gn'] },
  { usfm: 'EXO', name: 'Exodus', aliases: ['exodus', 'exod', 'exo', 'ex'] },
  { usfm: 'LEV', name: 'Leviticus', aliases: ['leviticus', 'lev', 'lv'] },
  { usfm: 'NUM', name: 'Numbers', aliases: ['numbers', 'num', 'nm', 'nb'] },
  { usfm: 'DEU', name: 'Deuteronomy', aliases: ['deuteronomy', 'deut', 'deu', 'dt'] },
  { usfm: 'JOS', name: 'Joshua', aliases: ['joshua', 'josh', 'jos', 'jsh'] },
  { usfm: 'JDG', name: 'Judges', aliases: ['judges', 'judg', 'jdg', 'jg'] },
  { usfm: 'RUT', name: 'Ruth', aliases: ['ruth', 'rut', 'rth'] },
  { usfm: '1SA', name: '1 Samuel', aliases: ['1 samuel', '1samuel', '1 sam', '1sam', '1 sa', '1sa', 'first samuel', 'i samuel'] },
  { usfm: '2SA', name: '2 Samuel', aliases: ['2 samuel', '2samuel', '2 sam', '2sam', '2 sa', '2sa', 'second samuel', 'ii samuel'] },
  { usfm: '1KI', name: '1 Kings', aliases: ['1 kings', '1kings', '1 kgs', '1kgs', '1 ki', '1ki', 'first kings', 'i kings'] },
  { usfm: '2KI', name: '2 Kings', aliases: ['2 kings', '2kings', '2 kgs', '2kgs', '2 ki', '2ki', 'second kings', 'ii kings'] },
  { usfm: '1CH', name: '1 Chronicles', aliases: ['1 chronicles', '1chronicles', '1 chron', '1chron', '1 chr', '1chr', 'first chronicles', 'i chronicles'] },
  { usfm: '2CH', name: '2 Chronicles', aliases: ['2 chronicles', '2chronicles', '2 chron', '2chron', '2 chr', '2chr', 'second chronicles', 'ii chronicles'] },
  { usfm: 'EZR', name: 'Ezra', aliases: ['ezra', 'ezr'] },
  { usfm: 'NEH', name: 'Nehemiah', aliases: ['nehemiah', 'neh'] },
  { usfm: 'EST', name: 'Esther', aliases: ['esther', 'esth', 'est'] },
  { usfm: 'JOB', name: 'Job', aliases: ['job', 'jb'] },
  { usfm: 'PSA', name: 'Psalms', aliases: ['psalms', 'psalm', 'pslm', 'psa', 'pss', 'ps'] },
  { usfm: 'PRO', name: 'Proverbs', aliases: ['proverbs', 'prov', 'pro', 'prv'] },
  { usfm: 'ECC', name: 'Ecclesiastes', aliases: ['ecclesiastes', 'eccles', 'eccle', 'ecc', 'qoh'] },
  { usfm: 'SNG', name: 'Song of Solomon', aliases: ['song of solomon', 'song of songs', 'song', 'sos', 'sng', 'canticles'] },
  { usfm: 'ISA', name: 'Isaiah', aliases: ['isaiah', 'isa', 'is'] },
  { usfm: 'JER', name: 'Jeremiah', aliases: ['jeremiah', 'jer', 'jr'] },
  { usfm: 'LAM', name: 'Lamentations', aliases: ['lamentations', 'lam'] },
  { usfm: 'EZK', name: 'Ezekiel', aliases: ['ezekiel', 'ezek', 'ezk', 'eze'] },
  { usfm: 'DAN', name: 'Daniel', aliases: ['daniel', 'dan', 'dn'] },
  { usfm: 'HOS', name: 'Hosea', aliases: ['hosea', 'hos'] },
  { usfm: 'JOL', name: 'Joel', aliases: ['joel', 'jol', 'joe'] },
  { usfm: 'AMO', name: 'Amos', aliases: ['amos', 'amo', 'am'] },
  { usfm: 'OBA', name: 'Obadiah', aliases: ['obadiah', 'obad', 'oba', 'ob'] },
  { usfm: 'JON', name: 'Jonah', aliases: ['jonah', 'jon', 'jnh'] },
  { usfm: 'MIC', name: 'Micah', aliases: ['micah', 'mic', 'mc'] },
  { usfm: 'NAM', name: 'Nahum', aliases: ['nahum', 'nah', 'nam'] },
  { usfm: 'HAB', name: 'Habakkuk', aliases: ['habakkuk', 'hab', 'hb'] },
  { usfm: 'ZEP', name: 'Zephaniah', aliases: ['zephaniah', 'zeph', 'zep', 'zp'] },
  { usfm: 'HAG', name: 'Haggai', aliases: ['haggai', 'hag', 'hg'] },
  { usfm: 'ZEC', name: 'Zechariah', aliases: ['zechariah', 'zech', 'zec', 'zc'] },
  { usfm: 'MAL', name: 'Malachi', aliases: ['malachi', 'mal', 'ml'] },
  { usfm: 'MAT', name: 'Matthew', aliases: ['matthew', 'matt', 'mat', 'mt'] },
  { usfm: 'MRK', name: 'Mark', aliases: ['mark', 'mrk', 'mar', 'mk'] },
  { usfm: 'LUK', name: 'Luke', aliases: ['luke', 'luk', 'lk'] },
  { usfm: 'JHN', name: 'John', aliases: ['john', 'jhn', 'jn'] },
  { usfm: 'ACT', name: 'Acts', aliases: ['acts', 'act', 'ac'] },
  { usfm: 'ROM', name: 'Romans', aliases: ['romans', 'rom', 'rm'] },
  { usfm: '1CO', name: '1 Corinthians', aliases: ['1 corinthians', '1corinthians', '1 cor', '1cor', '1 co', '1co', 'first corinthians', 'i corinthians'] },
  { usfm: '2CO', name: '2 Corinthians', aliases: ['2 corinthians', '2corinthians', '2 cor', '2cor', '2 co', '2co', 'second corinthians', 'ii corinthians'] },
  { usfm: 'GAL', name: 'Galatians', aliases: ['galatians', 'gal', 'ga'] },
  { usfm: 'EPH', name: 'Ephesians', aliases: ['ephesians', 'eph', 'ephes'] },
  { usfm: 'PHP', name: 'Philippians', aliases: ['philippians', 'phil', 'php', 'pp'] },
  { usfm: 'COL', name: 'Colossians', aliases: ['colossians', 'col', 'co'] },
  { usfm: '1TH', name: '1 Thessalonians', aliases: ['1 thessalonians', '1thessalonians', '1 thess', '1thess', '1 th', '1th', 'first thessalonians', 'i thessalonians'] },
  { usfm: '2TH', name: '2 Thessalonians', aliases: ['2 thessalonians', '2thessalonians', '2 thess', '2thess', '2 th', '2th', 'second thessalonians', 'ii thessalonians'] },
  { usfm: '1TI', name: '1 Timothy', aliases: ['1 timothy', '1timothy', '1 tim', '1tim', '1 ti', '1ti', 'first timothy', 'i timothy'] },
  { usfm: '2TI', name: '2 Timothy', aliases: ['2 timothy', '2timothy', '2 tim', '2tim', '2 ti', '2ti', 'second timothy', 'ii timothy'] },
  { usfm: 'TIT', name: 'Titus', aliases: ['titus', 'tit', 'ti'] },
  { usfm: 'PHM', name: 'Philemon', aliases: ['philemon', 'philem', 'phm', 'pm'] },
  { usfm: 'HEB', name: 'Hebrews', aliases: ['hebrews', 'heb'] },
  { usfm: 'JAS', name: 'James', aliases: ['james', 'jas', 'jm'] },
  { usfm: '1PE', name: '1 Peter', aliases: ['1 peter', '1peter', '1 pet', '1pet', '1 pe', '1pe', 'first peter', 'i peter'] },
  { usfm: '2PE', name: '2 Peter', aliases: ['2 peter', '2peter', '2 pet', '2pet', '2 pe', '2pe', 'second peter', 'ii peter'] },
  { usfm: '1JN', name: '1 John', aliases: ['1 john', '1john', '1 jhn', '1jhn', '1 jn', '1jn', 'first john', 'i john'] },
  { usfm: '2JN', name: '2 John', aliases: ['2 john', '2john', '2 jhn', '2jhn', '2 jn', '2jn', 'second john', 'ii john'] },
  { usfm: '3JN', name: '3 John', aliases: ['3 john', '3john', '3 jhn', '3jhn', '3 jn', '3jn', 'third john', 'iii john'] },
  { usfm: 'JUD', name: 'Jude', aliases: ['jude', 'jud', 'jd'] },
  { usfm: 'REV', name: 'Revelation', aliases: ['revelation', 'revelations', 'rev', 'rv'] },
];

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

const ALIAS_TO_BOOK: Record<string, BibleBook> = (() => {
  const map: Record<string, BibleBook> = {};
  const addAlias = (alias: string, book: BibleBook) => {
    map[alias] = book;
    const wordOrdinals: Record<string, string> = { '1': 'first', '2': 'second', '3': 'third' };
    const romanOrdinals: Record<string, string> = { '1': 'i', '2': 'ii', '3': 'iii' };
    const compactOrdinal = alias.match(/^([123])([a-z].*)$/);
    if (compactOrdinal) {
      const suffix = compactOrdinal[1] === '1' ? 'st' : compactOrdinal[1] === '2' ? 'nd' : 'rd';
      map[`${compactOrdinal[1]}${suffix}${compactOrdinal[2]}`] = book;
      map[`${wordOrdinals[compactOrdinal[1]]}${compactOrdinal[2]}`] = book;
      map[`${romanOrdinals[compactOrdinal[1]]}${compactOrdinal[2]}`] = book;
    }
    const spacedOrdinal = alias.match(/^([123])\s+(.+)$/);
    if (spacedOrdinal) {
      const suffix = spacedOrdinal[1] === '1' ? 'st' : spacedOrdinal[1] === '2' ? 'nd' : 'rd';
      map[`${spacedOrdinal[1]}${suffix} ${spacedOrdinal[2]}`] = book;
      map[`${wordOrdinals[spacedOrdinal[1]]} ${spacedOrdinal[2]}`] = book;
      map[`${romanOrdinals[spacedOrdinal[1]]} ${spacedOrdinal[2]}`] = book;
    }
  };
  BIBLE_BOOKS.forEach((book) => book.aliases.forEach((alias) => addAlias(alias, book)));
  return map;
})();

const BOOK_ALTERNATION = Object.keys(ALIAS_TO_BOOK)
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
  .join('|');
/**
 * Chapter/verse separator. In strict mode (inline caption detection) the verse
 * must be introduced by an explicit marker (":", ".", "v", "vs", "verse") so
 * prose like "I read John 3 16 times" never auto-links. Loose mode also accepts
 * a plain run of whitespace, so the composer picker resolves "John 3 16".
 */
const buildRefSource = (looseSeparator: boolean): string => {
  const separator = looseSeparator
    ? `(?:\\s*(?:[:.]|v(?:s|erse)?)\\s*|\\s+)`
    : `\\s*(?:[:.]|v(?:s|erse)?)\\s*`;
  return `\\b(${BOOK_ALTERNATION})\\.?\\s*(\\d{1,3})(?:${separator}(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?`;
};

const LOCAL_REF_REGEX = new RegExp(buildRefSource(false), 'gi');
const LOCAL_REF_REGEX_LOOSE = new RegExp(buildRefSource(true), 'gi');

export function buildScriptureKey(
  book: string,
  chapter: number,
  verse: number,
  verseEnd?: number,
): string {
  const normalizedBook = String(book ?? '').trim().toUpperCase();
  const normalizedChapter = Number(chapter);
  const normalizedVerse = Number(verse);
  const normalizedVerseEnd = verseEnd ? Number(verseEnd) : normalizedVerse;
  if (!normalizedBook || !normalizedChapter || !normalizedVerse) return '';
  const range =
    normalizedVerseEnd > normalizedVerse
      ? `${normalizedVerse}-${normalizedVerseEnd}`
      : `${normalizedVerse}`;
  return `${normalizedBook}.${normalizedChapter}.${range}`;
}

export function normalizeScriptureKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function parseScriptureLocal(
  text: string,
  options?: { looseSeparator?: boolean },
): ScriptureMention[] {
  if (!text) return [];
  const base = options?.looseSeparator ? LOCAL_REF_REGEX_LOOSE : LOCAL_REF_REGEX;
  const regex = new RegExp(base.source, 'gi');
  const mentions: ScriptureMention[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const [full, rawBook, rawChapter, rawVerse, rawVerseEnd] = match;
    if (!rawVerse) continue;
    const alias = rawBook.toLowerCase().replace(/\s+/g, ' ').trim();
    const book = ALIAS_TO_BOOK[alias];
    if (!book) continue;
    const chapter = Number(rawChapter);
    const verse = Number(rawVerse);
    const verseEnd = rawVerseEnd ? Number(rawVerseEnd) : verse;
    if (!chapter || !verse || verseEnd < verse) continue;
    const reference =
      verseEnd > verse
        ? `${book.name} ${chapter}:${verse}-${verseEnd}`
        : `${book.name} ${chapter}:${verse}`;
    mentions.push({
      reference,
      key: buildScriptureKey(book.usfm, chapter, verse, verseEnd),
      book: book.usfm,
      bookName: book.name,
      chapter,
      verse,
      verseEnd,
      startIndex: match.index,
      endIndex: match.index + full.length,
    });
  }
  return mentions;
}

/** True if the text plausibly contains a scripture reference (chip trigger). */
export function hasLikelyScripture(text: string): boolean {
  return parseScriptureLocal(text).length > 0;
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

export async function fetchScriptureShare(
  m: Pick<ScriptureMention, 'book' | 'chapter' | 'verse' | 'verseEnd'>,
  translation: string = DEFAULT_TRANSLATION,
): Promise<ScriptureShare> {
  const verse = await fetchVerse(m, translation);
  return {
    ...verse,
    key: buildScriptureKey(verse.book, verse.chapter, verse.verse, verse.verseEnd),
  };
}

export async function fetchScriptureShareCounts(keys: string[]): Promise<Record<string, number>> {
  const normalizedKeys = Array.from(new Set(keys.map(normalizeScriptureKey).filter(Boolean)));
  if (normalizedKeys.length === 0) return {};
  try {
    const res = await api.get<{ counts?: Record<string, number> }>('scripture/share-counts', {
      keys: normalizedKeys.join(','),
    });
    return res?.counts ?? {};
  } catch {
    return {};
  }
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
