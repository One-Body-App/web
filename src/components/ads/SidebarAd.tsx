import { useApiQuery } from '@/api/useApi';
import {fetchSidebarAds, type InlineAd} from '../../api/ads';
import InlineAdCard from './InlineAdCard';
import './SidebarAd.css';

/**
 * One small sponsored ad for the web right-hand sidebar (web_sidebar zone).
 * Renders nothing if no ad is available, so it's safe to always mount.
 */
export default function SidebarAd() {
  const { data } = useApiQuery<InlineAd[]>(() => fetchSidebarAds(), { fallback: [] });
  const ad = data?.[0] ?? null;

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
