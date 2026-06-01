import {useEffect, useState} from 'react';
import {fetchSidebarAds, type InlineAd} from '../../api/ads';
import InlineAdCard from './InlineAdCard';
import './SidebarAd.css';

/**
 * One small sponsored ad for the web right-hand sidebar (web_sidebar zone).
 * Renders nothing if no ad is available, so it's safe to always mount.
 */
export default function SidebarAd() {
  const [ad, setAd] = useState<InlineAd | null>(null);

  useEffect(() => {
    let active = true;
    fetchSidebarAds()
      .then(ads => {
        if (active && ads.length > 0) {
          setAd(ads[0]);
        }
      })
      .catch(() => {
        // Best-effort: no sidebar ad on failure.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!ad) {
    return null;
  }

  return (
    <aside className="sidebar-ad">
      {/* Sidebar always uses the slim banner format. */}
      <InlineAdCard ad={ad} variant="banner" />
    </aside>
  );
}
