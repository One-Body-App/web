import { useEffect, useRef, useState } from 'react';
import {
  bibleAppUrl,
  DEFAULT_TRANSLATION,
  fetchTranslations,
  fetchVerse,
  type BibleTranslation,
  type ScriptureMention,
  type VerseResult,
} from '../../api/scripture';
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
  const [verse, setVerse] = useState<VerseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [translations, setTranslations] = useState<BibleTranslation[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Load the verse whenever the chosen translation changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetchVerse(mention, translation)
      .then((v) => {
        if (active) {
          setVerse(v);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [mention, translation]);

  // Populate the version dropdown once.
  useEffect(() => {
    let active = true;
    fetchTranslations().then((list) => active && setTranslations(list));
    return () => {
      active = false;
    };
  }, []);

  // Close on Escape; focus the dialog for accessibility.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  const options: BibleTranslation[] = translations.length
    ? translations
    : [
        { id: 'BSB', name: 'Berean Standard Bible', englishName: 'BSB', language: 'eng' },
        { id: 'engKJV', name: 'King James Version', englishName: 'KJV', language: 'eng' },
        { id: 'WEB', name: 'World English Bible', englishName: 'WEB', language: 'eng' },
      ];

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
                {t.shortName || t.englishName || t.name}
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
            <button
              type="button"
              className="scripture-modal__open"
              onClick={openInBibleApp}
            >
              Open in Bible app →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ScriptureModal;
