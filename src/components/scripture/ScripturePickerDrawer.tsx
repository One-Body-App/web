import { useMemo, useState, type KeyboardEvent } from 'react';
import { BookOpen, Check, Loader2, Search, X } from 'lucide-react';
import {
  BIBLE_BOOKS,
  DEFAULT_TRANSLATION,
  bibleTranslationOptions,
  fetchScriptureShare,
  fetchTranslations,
  parseScriptureLocal,
  translationLabel,
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

function findBook(usfm?: string) {
  if (!usfm) return null;
  return BIBLE_BOOKS.find((book) => book.usfm === usfm.toUpperCase()) ?? null;
}

function cleanNumberInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 3);
}

function buildStructuredMention(
  book: BibleBook | null,
  chapterValue: string,
  verseValue: string,
): ScriptureMention | null {
  if (!book) return null;
  const chapter = Number(chapterValue);
  const verse = Number(verseValue);
  if (!chapter || !verse) return null;
  const reference = `${book.name} ${chapter}:${verse}`;
  return {
    reference,
    book: book.usfm,
    bookName: book.name,
    chapter,
    verse,
    verseEnd: verse,
    startIndex: 0,
    endIndex: reference.length,
  };
}

type PickerState = {
  query: string;
  translation: string;
  selectedBook: BibleBook | null;
  chapter: string;
  verse: string;
  loadingRef: string;
  error: string;
};

function initialPickerState(selected?: ScriptureShare | null): PickerState {
  return {
    query: '',
    translation: selected?.translation ?? DEFAULT_TRANSLATION,
    selectedBook: findBook(selected?.book),
    chapter: selected?.chapter ? String(selected.chapter) : '',
    verse: selected?.verse ? String(selected.verse) : '',
    loadingRef: '',
    error: '',
  };
}

export function ScripturePickerDrawer({ open, selected, onSelect, onClear }: Props) {
  const [state, setState] = useState(() => initialPickerState(selected));
  const { query, translation, selectedBook, chapter, verse, loadingRef, error } = state;
  const updateState = (patch: Partial<PickerState>) => {
    setState((current) => ({ ...current, ...patch }));
  };
  const translationsQuery = useApiQuery<BibleTranslation[]>(() => fetchTranslations(), { fallback: [] });
  const translationOptions = useMemo(
    () => bibleTranslationOptions(translationsQuery.data ?? []),
    [translationsQuery.data],
  );
  const selectedMatchesQuery = Boolean(selected?.reference && selected.reference === query.trim());
  const exact = selectedMatchesQuery ? null : parseScriptureLocal(query)[0] ?? null;
  const structuredMention = buildStructuredMention(selectedBook, chapter, verse);
  const structuredReference = selectedBook
    ? `${selectedBook.name}${chapter ? ` ${chapter}` : ''}${verse ? `:${verse}` : ''}`
    : '';
  const suggestions = useMemo(() => {
    const trimmed = query.trim();
    if (exact || selectedBook) return [];
    return BIBLE_BOOKS.filter((book) => matchesBook(book, trimmed)).slice(0, 8);
  }, [exact, query, selectedBook]);

  const pickReference = async (mention: ScriptureMention) => {
    updateState({ error: '', loadingRef: mention.reference });
    try {
      const share = await fetchScriptureShare(toPayload(mention), translation);
      onSelect(share);
      updateState({ query: share.reference });
    } catch {
      updateState({ error: 'Could not load that verse. Check the reference and try again.' });
    } finally {
      updateState({ loadingRef: '' });
    }
  };

  const pickBook = (book: BibleBook) => {
    updateState({
      selectedBook: book,
      query: book.name,
      chapter: '',
      verse: '',
      error: '',
    });
  };

  const clearBook = () => {
    updateState({
      selectedBook: null,
      query: '',
      chapter: '',
      verse: '',
      error: '',
    });
  };

  const clearSelected = () => {
    clearBook();
    onClear();
  };

  const changeTranslation = async (nextTranslation: string) => {
    updateState({
      translation: nextTranslation,
      error: '',
      loadingRef: selected?.reference ?? '',
    });
    if (!selected) return;
    try {
      const share = await fetchScriptureShare(toPayload(selected), nextTranslation);
      onSelect(share);
      updateState({ query: share.reference });
    } catch {
      updateState({ error: 'Could not load that version. Please try again.' });
    } finally {
      updateState({ loadingRef: '' });
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && exact) {
      event.preventDefault();
      void pickReference(exact);
    }
  };

  const inputChanged = (value: string) => {
    updateState({
      query: value,
      selectedBook: null,
      chapter: '',
      verse: '',
      error: '',
    });
  };

  const content = (
    <div className="scripture-picker__inner">
      <div className="scripture-picker__search">
        <Search size={16} strokeWidth={2.25} />
        <input
          value={query}
          onChange={(event) => inputChanged(event.target.value)}
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
          <button type="button" onClick={clearSelected} aria-label="Remove selected scripture">
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
      ) : selectedBook ? (
        <div className="scripture-picker__structured">
          <div className="scripture-picker__picked-book">
            <BookOpen size={15} />
            <div>
              <span>Book</span>
              <strong>{selectedBook.name}</strong>
            </div>
            <button type="button" onClick={clearBook} aria-label="Change selected book">
              <X size={15} />
            </button>
          </div>

          <div className="scripture-picker__fields">
            <label className="scripture-picker__field">
              <span>Chapter</span>
              <input
                value={chapter}
                onChange={(event) => {
                  updateState({
                    chapter: cleanNumberInput(event.target.value),
                    error: '',
                  });
                }}
                inputMode="numeric"
                min={1}
                placeholder="3"
                type="number"
              />
            </label>

            {chapter ? (
              <label className="scripture-picker__field">
                <span>Verse</span>
                <input
                  value={verse}
                  onChange={(event) => {
                    updateState({
                      verse: cleanNumberInput(event.target.value),
                      error: '',
                    });
                  }}
                  inputMode="numeric"
                  min={1}
                  placeholder="16"
                  type="number"
                />
              </label>
            ) : null}
          </div>

          <button
            type="button"
            className="scripture-picker__exact"
            onClick={() => {
              if (structuredMention) void pickReference(structuredMention);
            }}
            disabled={!structuredMention || Boolean(loadingRef)}
          >
            {loadingRef === structuredMention?.reference ? (
              <Loader2 size={16} className="scripture-picker__spin" />
            ) : (
              <Check size={16} />
            )}
            <span>{structuredMention ? `Use ${structuredMention.reference}` : 'Use verse'}</span>
          </button>
        </div>
      ) : (
        <div className="scripture-picker__suggestions" aria-label="Bible books">
          {suggestions.map((book) => (
            <button
              key={book.usfm}
              type="button"
              className="scripture-picker__book"
              onClick={() => pickBook(book)}
            >
              <BookOpen size={15} />
              <span>{book.name}</span>
            </button>
          ))}
        </div>
      )}

      {structuredReference && !structuredMention ? (
        <p className="scripture-picker__hint">Choose a chapter and verse for {structuredReference}.</p>
      ) : null}

      {error ? <p className="scripture-picker__error">{error}</p> : null}
    </div>
  );

  if (!open) {
    return <div className="scripture-picker" aria-hidden="true" />;
  }

  return (
    <div className="scripture-picker is-open">
      {content}
    </div>
  );
}

export default ScripturePickerDrawer;
