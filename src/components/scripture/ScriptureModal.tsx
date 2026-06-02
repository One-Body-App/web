import { useCallback, useRef, useState } from 'react';
import {
  bibleAppUrl,
  DEFAULT_TRANSLATION,
  bibleTranslationOptions,
  buildScriptureKey,
  fetchScriptureShareCounts,
  fetchTranslations,
  fetchVerse,
  translationLabel,
  type BibleTranslation,
  type ScriptureMention,
  type VerseResult,
} from '../../api/scripture';
import { useApiQuery } from '../../api/useApi';
import './scripture.css';

/**
 * Verse popup. Opens on clicking a scripture hyperlink in the feed.
 * - shows a loading skeleton instantly
 * - fetches the verse (proxied + cached through our API)
 * - lets the READER temporarily switch translation, independent of the poster's
 *
 * Brand colors are applied via the .scripture-modal scope in scripture.css:
 * surface #e6eaec, header #41899f, text #032f3c (all existing theme tokens).
 */
export function ScriptureModal({
  mention,
  posterTranslation = DEFAULT_TRANSLATION,
  onClose,
}: {
  mention: ScriptureMention;
  posterTranslation?: string;
  onClose: () => void;
}) {
  const [translation, setTranslation] = useState(posterTranslation);
  const dialogCleanupRef = useRef<(() => void) | null>(null);
  const verseQuery = useApiQuery<VerseResult>(
    () => fetchVerse(mention, translation),
    {
      deps: [
        mention.reference,
        mention.book,
        mention.chapter,
        mention.verse,
        mention.verseEnd,
        translation,
      ],
    },
  );
  const translationsQuery = useApiQuery<BibleTranslation[]>(() => fetchTranslations(), { fallback: [] });
  const shareKey =
    mention.key ?? buildScriptureKey(mention.book, mention.chapter, mention.verse, mention.verseEnd);
  const shareCountQuery = useApiQuery<Record<string, number>>(
    () => fetchScriptureShareCounts([shareKey]),
    { deps: [shareKey], enabled: shareKey.length > 0, fallback: {} },
  );

  const dialogRef = useCallback((node: HTMLDivElement | null) => {
    dialogCleanupRef.current?.();
    dialogCleanupRef.current = null;
    if (!node) return;
    node.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    dialogCleanupRef.current = () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Open the OS share sheet (the native "picker") with the reference + a
  // YouVersion link, so the reader can send it to any Bible app they have.
  // Falls back to copying the link when the browser has no Web Share API.
  const openInBibleApp = () => {
    const url = bibleAppUrl(mention);
    const shareData = { title: mention.reference, text: mention.reference, url };
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share(shareData).catch(() => {
        /* user dismissed — no-op */
      });
    } else if (navigator?.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const verse = verseQuery.data ?? null;
  const loading = verseQuery.loading && !verse;
  const error = Boolean(verseQuery.error);
  const options: BibleTranslation[] = bibleTranslationOptions(translationsQuery.data ?? []);
  const shareCount = mention.shareCount ?? shareCountQuery.data?.[shareKey] ?? 0;

  return (
    <div className="scripture-modal__scrim" onClick={onClose} role="presentation">
      <div
        className="scripture-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mention.reference}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="scripture-modal__head">
          <span className="scripture-modal__ref">{mention.reference}</span>
          <select
            className="scripture-modal__version"
            aria-label="Bible version"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
          >
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {translationLabel(t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="scripture-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="scripture-modal__body">
          {loading ? (
            <div className="scripture-modal__skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : error ? (
            <p className="scripture-modal__error">
              Couldn’t load this verse right now. Please try again.
            </p>
          ) : (
            <blockquote className="scripture-modal__text">{verse?.text}</blockquote>
          )}

          {!loading && !error ? (
            <div className="scripture-modal__foot">
              <span className="scripture-modal__count">
                {shareCount.toLocaleString()} shares
              </span>
              <button
                type="button"
                className="scripture-modal__open"
                onClick={openInBibleApp}
              >
                Open in Bible app →
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ScriptureModal;
