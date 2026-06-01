import { useMemo, useState, type KeyboardEvent } from 'react';
import { BookOpen, Check, Loader2, Search, X } from 'lucide-react';
import {
  BIBLE_BOOKS,
  DEFAULT_TRANSLATION,
  fetchScriptureShare,
  fetchTranslations,
  parseScriptureLocal,
  type BibleBook,
  type BibleTranslation,
  type ScriptureMention,
  type ScriptureShare,
} from '../../api/scripture';
import { useApiQuery } from '../../api/useApi';
import './scripture.css';

type Props = {
  open: boolean;
  selected?: ScriptureShare | null;
  onSelect: (share: ScriptureShare) => void;
  onClear: () => void;
};

function matchesBook(book: BibleBook, query: string) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return true;
  return (
    book.name.toLowerCase().includes(normalized) ||
    book.aliases.some((alias) => alias.includes(normalized))
  );
}

function toPayload(mention: Pick<ScriptureMention, 'book' | 'chapter' | 'verse' | 'verseEnd'>) {
  return {
    book: mention.book,
    chapter: mention.chapter,
    verse: mention.verse,
    verseEnd: mention.verseEnd,
  };
}

const FALLBACK_TRANSLATIONS: BibleTranslation[] = [
  { id: 'BSB', name: 'Berean Standard Bible', englishName: 'BSB', language: 'eng' },
  { id: 'engKJV', name: 'King James Version', englishName: 'KJV', language: 'eng' },
  { id: 'WEB', name: 'World English Bible', englishName: 'WEB', language: 'eng' },
];

function translationLabel(translation: BibleTranslation) {
  return translation.shortName || translation.englishName || translation.name || translation.id;
}

export function ScripturePickerDrawer({ open, selected, onSelect, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [translation, setTranslation] = useState(selected?.translation ?? DEFAULT_TRANSLATION);
  const [loadingRef, setLoadingRef] = useState('');
  const [error, setError] = useState('');
  const translationsQuery = useApiQuery<BibleTranslation[]>(() => fetchTranslations(), { fallback: [] });
  const translationOptions = translationsQuery.data?.length
    ? translationsQuery.data
    : FALLBACK_TRANSLATIONS;
  const exact = parseScriptureLocal(query)[0] ?? null;
  const suggestions = useMemo(() => {
    const trimmed = query.trim();
    if (exact) return [];
    return BIBLE_BOOKS.filter((book) => matchesBook(book, trimmed)).slice(0, 8);
  }, [exact, query]);

  const pickReference = async (mention: ScriptureMention) => {
    setError('');
    setLoadingRef(mention.reference);
    try {
      const share = await fetchScriptureShare(toPayload(mention), translation);
      onSelect(share);
      setQuery(share.reference);
    } catch {
      setError('Could not load that verse. Check the reference and try again.');
    } finally {
      setLoadingRef('');
    }
  };

  const changeTranslation = async (nextTranslation: string) => {
    setTranslation(nextTranslation);
    setError('');
    if (!selected) return;
    setLoadingRef(selected.reference);
    try {
      const share = await fetchScriptureShare(toPayload(selected), nextTranslation);
      onSelect(share);
      setQuery(share.reference);
    } catch {
      setError('Could not load that version. Please try again.');
    } finally {
      setLoadingRef('');
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && exact) {
      event.preventDefault();
      void pickReference(exact);
    }
  };

  return (
    <div className={`scripture-picker${open ? ' is-open' : ''}`} aria-hidden={open ? 'false' : 'true'}>
      <div className="scripture-picker__inner">
        <div className="scripture-picker__search">
          <Search size={16} strokeWidth={2.25} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setError('');
            }}
            onKeyDown={keyDown}
            placeholder="Search a verse, e.g. John 3:16"
            aria-label="Search scripture"
          />
        </div>

        <label className="scripture-picker__version">
          <span>Bible version</span>
          <select
            value={translation}
            onChange={(event) => void changeTranslation(event.target.value)}
            aria-label="Bible version"
          >
            {translationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {translationLabel(option)}
              </option>
            ))}
          </select>
        </label>

        {selected ? (
          <article className="scripture-picker__selected">
            <div>
              <strong>{selected.reference}</strong>
              <span>{selected.translation}</span>
            </div>
            <button type="button" onClick={onClear} aria-label="Remove selected scripture">
              <X size={15} />
            </button>
          </article>
        ) : null}

        {exact ? (
          <button
            type="button"
            className="scripture-picker__exact"
            onClick={() => void pickReference(exact)}
            disabled={Boolean(loadingRef)}
          >
            {loadingRef ? <Loader2 size={16} className="scripture-picker__spin" /> : <Check size={16} />}
            <span>Use {exact.reference}</span>
          </button>
        ) : (
          <div className="scripture-picker__suggestions" role="listbox" aria-label="Bible books">
            {suggestions.map((book) => (
              <button
                key={book.usfm}
                type="button"
                className="scripture-picker__book"
                onClick={() => setQuery(`${book.name} `)}
              >
                <BookOpen size={15} />
                <span>{book.name}</span>
              </button>
            ))}
          </div>
        )}

        {error ? <p className="scripture-picker__error">{error}</p> : null}
      </div>
    </div>
  );
}

export default ScripturePickerDrawer;
