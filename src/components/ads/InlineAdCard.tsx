import { useEffect, useRef, useState } from 'react';
import {
  ADVERTISER_PORTAL_URL,
  getInlineAdId,
  reportAdClick,
  reportAdImpression,
  reportAdReport,
  type AdFormat,
  type InlineAd,
} from '../../api/ads';
import './InlineAdCard.css';

/**
 * Sponsored "InlineAdCard" for the web feed (mirror of the mobile component).
 *
 * - Two formats: 'banner' (slim rectangle, small) and 'square' (1:1 card).
 * - White card, border #cdd5d8, radius 8; "Promoted" badge (bg #d0f6f7, text #126b87);
 *   title #032f3c. Sits on a subtle sponsored band.
 * - Fires the impression beacon once when >= 50% visible (IntersectionObserver, deduped).
 * - Clicking opens a small picker: "View site" (records a click + opens targetUrl) or
 *   "Report ad" (records a report). A small "Advertise with us" link points to the portal.
 */
export function InlineAdCard({ ad, variant }: { ad: InlineAd; variant?: AdFormat }) {
  const adId = getInlineAdId(ad);
  const format: AdFormat = variant ?? ad?.format ?? 'square';
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || !adId) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            reportAdImpression(adId);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [adId]);

  if (!ad || (!ad.imageUrl && !ad.title)) {
    return null;
  }

  const openSite = () => {
    setMenuOpen(false);
    reportAdClick(adId);
    if (ad.targetUrl) {
      window.open(ad.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const reportAd = () => {
    setMenuOpen(false);
    reportAdReport(adId);
    window.alert('Thanks for reporting. Our team will review this ad.');
  };

  return (
    <div className={`inline-ad-card inline-ad-card--${format}`} ref={cardRef}>
      <div className="inline-ad-card__meta">
        <span className="inline-ad-card__badge">Sponsored</span>
        <a
          className="inline-ad-card__advertise"
          href={ADVERTISER_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Advertise with us
        </a>
      </div>

      <button
        type="button"
        className="inline-ad-card__body"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={ad.title ? `Sponsored: ${ad.title}` : 'Sponsored'}
      >
        {format !== 'banner' && ad.title ? (
          <p className="inline-ad-card__title">{ad.title}</p>
        ) : null}
        {ad.imageUrl ? (
          <img className="inline-ad-card__image" src={ad.imageUrl} alt={ad.title || 'Sponsored'} />
        ) : null}
      </button>

      {menuOpen ? (
        <div className="inline-ad-card__menu" role="menu">
          <button type="button" className="inline-ad-card__menu-item" onClick={openSite}>
            View site
          </button>
          <button
            type="button"
            className="inline-ad-card__menu-item inline-ad-card__menu-item--danger"
            onClick={reportAd}
          >
            Report ad
          </button>
          <button
            type="button"
            className="inline-ad-card__menu-item"
            onClick={() => setMenuOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default InlineAdCard;
