import { Eye, X } from 'lucide-react';
import type { ScriptureShare } from '../../api/scripture';
import './scripture.css';

const formatCount = (value?: number): string =>
  Math.max(0, Number(value ?? 0)).toLocaleString();

type Props = {
  share: Pick<ScriptureShare, 'reference' | 'translation' | 'text' | 'shareCount'>;
  /** When provided, renders a remove (x) control — used in the composer. */
  onRemove?: () => void;
};

/**
 * The shared "scripture quote" card — a repost/quote-style frame (accent rail +
 * quotation mark) carrying the reference, translation, verse text and
 * times-shared count. Used in the composer (attached preview, with onRemove)
 * and anywhere a shared scripture is shown, so it reads the same everywhere.
 */
export function ScriptureQuoteCard({ share, onRemove }: Props) {
  return (
    <div className="scripture-quote">
      {onRemove ? (
        <button
          type="button"
          className="scripture-quote__remove"
          onClick={onRemove}
          aria-label="Remove scripture"
        >
          <X size={15} />
        </button>
      ) : null}
      <blockquote className="scripture-quote__body">
        <span className="scripture-quote__mark" aria-hidden="true">
          &ldquo;
        </span>
        <p className="scripture-quote__text">{share.text}</p>
        <cite className="scripture-quote__ref">
          {share.reference}
          {share.translation ? (
            <span className="scripture-quote__translation"> &middot; {share.translation}</span>
          ) : null}
        </cite>
      </blockquote>
      <span className="scripture-quote__count">
        <Eye size={14} />
        {formatCount(share.shareCount)} shares
      </span>
    </div>
  );
}

export default ScriptureQuoteCard;
