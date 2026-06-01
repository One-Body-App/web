import { api } from './client';

/**
 * Sponsored inline feed ads (web mirror of the mobile useFeedAds hook).
 *
 * Backend contract:
 *  GET  /ads/serve?zone=feed_inline -> [{ _id|id, title, imageUrl, targetUrl, zone, format }]
 *  GET  /ads/serve?zone=web_sidebar -> same shape (one small ad for the right rail)
 *  POST /ads/:id/impression
 *  POST /ads/:id/click
 *  POST /ads/:id/report
 *
 * Reuses the shared authenticated `api` client (api.get / api.post), which attaches
 * the Clerk bearer token and returns parsed JSON (throwing ApiError on failure).
 */

export const INLINE_AD_ZONE = 'feed_inline';
export const SIDEBAR_AD_ZONE = 'web_sidebar';
export const DEFAULT_AD_INTERVAL = 6;

// Public advertiser portal (apply + manage campaigns). Override via Vite env.
export const ADVERTISER_PORTAL_URL =
  (import.meta.env.VITE_ADVERTISER_PORTAL_URL as string | undefined) ??
  'https://advertise.onebodyapp.com';

// Creative style; drives the rendered card. Defaults to 'square' when absent.
export type AdFormat = 'banner' | 'square';

export interface InlineAd {
  _id?: string;
  id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  zone?: string;
  format?: AdFormat;
}

export interface InlineAdEntry {
  __inlineAd: true;
  ad: InlineAd;
  adKey: string;
}

export const getInlineAdId = (ad: InlineAd | null | undefined): string =>
  String(ad?._id ?? ad?.id ?? '');

export const isInlineAdEntry = (entry: unknown): entry is InlineAdEntry =>
  Boolean(entry) && typeof entry === 'object' && (entry as InlineAdEntry).__inlineAd === true;

const normalizeAd = (raw: unknown): InlineAd | null => {
  if (!raw || typeof raw !== 'object') return null;
  const ad = raw as InlineAd;
  return getInlineAdId(ad) ? ad : null;
};

const extractAdsArray = (payload: unknown): InlineAd[] => {
  let source: unknown[] = [];
  if (Array.isArray(payload)) {
    source = payload;
  } else if (Array.isArray((payload as { data?: unknown })?.data)) {
    source = (payload as { data: unknown[] }).data;
  } else if (Array.isArray((payload as { content?: unknown })?.content)) {
    source = (payload as { content: unknown[] }).content;
  }
  return source.map(normalizeAd).filter((ad): ad is InlineAd => ad !== null);
};

/** Fetch inline feed ads once. Best-effort; returns [] on any failure. */
export async function fetchInlineAds(): Promise<InlineAd[]> {
  try {
    const data = await api.get<unknown>('ads/serve', { zone: INLINE_AD_ZONE });
    return extractAdsArray(data);
  } catch {
    return [];
  }
}

/** Fetch ads for the web right-hand sidebar (one small ad). Best-effort. */
export async function fetchSidebarAds(): Promise<InlineAd[]> {
  try {
    const data = await api.get<unknown>('ads/serve', { zone: SIDEBAR_AD_ZONE });
    return extractAdsArray(data);
  } catch {
    return [];
  }
}

/** Insert an ad sentinel after every `interval`-th item, cycling through ads. */
export function interleaveAds<T>(
  data: T[],
  ads: InlineAd[],
  interval: number = DEFAULT_AD_INTERVAL
): Array<T | InlineAdEntry> {
  if (!ads.length || !Array.isArray(data) || data.length < interval) {
    return data;
  }
  const result: Array<T | InlineAdEntry> = [];
  let adCursor = 0;
  data.forEach((item, index) => {
    result.push(item);
    if ((index + 1) % interval === 0) {
      const ad = ads[adCursor % ads.length];
      adCursor += 1;
      result.push({ __inlineAd: true, ad, adKey: `${getInlineAdId(ad)}-${index + 1}` });
    }
  });
  return result;
}

// Module-level session dedupe for impressions.
const reportedImpressions = new Set<string>();

export function reportAdImpression(adId: string): void {
  if (!adId || reportedImpressions.has(adId)) return;
  reportedImpressions.add(adId);
  api.post(`ads/${adId}/impression`).catch(() => {
    // best-effort beacon
  });
}

export async function reportAdClick(adId: string): Promise<void> {
  if (!adId) return;
  try {
    await api.post(`ads/${adId}/click`);
  } catch {
    // ignore; caller still opens targetUrl
  }
}

export async function reportAdReport(adId: string, reason?: string): Promise<void> {
  if (!adId) return;
  try {
    await api.post(`ads/${adId}/report`, reason ? { reason } : undefined);
  } catch {
    // ignore; reporting is best-effort
  }
}
