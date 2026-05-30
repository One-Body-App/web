import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Eye, ShieldQuestion } from 'lucide-react';
import './UnderReviewCard.css';

export type UnderReviewMediaThumb = {
  id: string;
  uri: string;
  kind: 'photo' | 'video';
};

export type UnderReviewCardProps = {
  // Eyebrow line. Defaults to "Under review".
  eyebrow?: string;
  // Title. Defaults to "Pause for a moment".
  title?: string;
  // Body copy explaining what's happening.
  body?: string;
  // Optional thumbnails of the media that triggered the review.
  thumbnails?: UnderReviewMediaThumb[];
  // Optional reason categories surfaced to the user.
  flaggedCategories?: string[];
  // Tap "View what was flagged" to expand and see the categories.
  onView?: () => void;
  // Optional appeal/contact CTA.
  onAppeal?: () => void;
};

const DEFAULT_TITLE = 'Pause for a moment';
const DEFAULT_BODY =
  'A steward is reviewing this post to make sure it aligns with the community. It is visible to you while we look. We will let you know what happens next.';

export function UnderReviewCard({
  eyebrow = 'Under review',
  title = DEFAULT_TITLE,
  body = DEFAULT_BODY,
  thumbnails,
  flaggedCategories,
  onView,
  onAppeal,
}: UnderReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = (flaggedCategories?.length ?? 0) > 0;

  function handleViewClick() {
    if (canExpand) {
      setExpanded((value) => !value);
    }
    onView?.();
  }

  return (
    <motion.article
      className="review-card card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
    >
      <span className="review-card__ribbon" aria-hidden="true" />

      <header className="review-card__head">
        <div className="review-card__icon" aria-hidden="true">
          <ShieldQuestion size={18} strokeWidth={2.25} />
        </div>
        <div className="review-card__id">
          <span className="review-card__eyebrow">{eyebrow}</span>
          <h3 className="review-card__title">{title}</h3>
        </div>
      </header>

      <p className="review-card__body">{body}</p>

      {thumbnails && thumbnails.length > 0 ? (
        <div className="review-card__thumbs" role="group" aria-label="Media being reviewed">
          {thumbnails.slice(0, 4).map((thumb) => (
            <div key={thumb.id} className="review-card__thumb">
              <img src={thumb.uri} alt="" loading="lazy" />
              {thumb.kind === 'video' ? <span className="review-card__thumb-tag">Video</span> : null}
            </div>
          ))}
          {thumbnails.length > 4 ? (
            <div className="review-card__thumb review-card__thumb--more">
              +{thumbnails.length - 4}
            </div>
          ) : null}
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {expanded && canExpand ? (
          <motion.ul
            className="review-card__reasons"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {flaggedCategories!.map((category) => (
              <li key={category} className="review-card__reason">
                {category}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      <footer className="review-card__actions">
        {canExpand ? (
          <button
            type="button"
            className="review-card__action"
            onClick={handleViewClick}
            aria-expanded={expanded ? 'true' : 'false'}
          >
            <Eye size={15} strokeWidth={2.25} />
            <span>{expanded ? 'Hide details' : 'View what was flagged'}</span>
            <ChevronRight size={14} strokeWidth={2.25} className="review-card__action-caret" />
          </button>
        ) : null}
        {onAppeal ? (
          <button
            type="button"
            className="review-card__action review-card__action--ghost"
            onClick={onAppeal}
          >
            Request a steward to take another look
          </button>
        ) : null}
      </footer>
    </motion.article>
  );
}
