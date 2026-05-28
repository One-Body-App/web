import { API_BASE_URL } from './config';

/**
 * Web port of mobile's `app/src/services/introAvatars.ts`. Fetches the same
 * `intro-avatars.json` endpoint from the API origin so the welcome screen
 * shows the same faces on both surfaces. Caches the result in localStorage
 * with the same shape mobile uses in AsyncStorage.
 */

const STORAGE_KEY = '@onebody:introAvatars';
export const INTRO_AVATAR_COUNT = 4;
const DEFAULT_PROFILE_PLACEHOLDER_PATH = '/user/no-image.png';
const CONFIGURED_PLACEHOLDER_URL = 'https://cdn.onebodyapp.com/user/no-image.png';

export type CachedIntroAvatars = {
  urls: (string | null)[];
  fetchedAt: number;
};

const EMPTY_AVATAR_SLOTS: (string | null)[] = Array(INTRO_AVATAR_COUNT).fill(null);

function getIntroAvatarUrl(): string {
  const trimmedBaseUrl = String(API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const publicOrigin = trimmedBaseUrl.replace(/\/api$/i, '');
  return `${publicOrigin}/intro-avatars.json`;
}

function isValidHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/.+/i.test(value.trim());
}

function isPlaceholderProfileImageUrl(value: unknown): boolean {
  if (!isValidHttpUrl(value)) return false;
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === CONFIGURED_PLACEHOLDER_URL.toLowerCase()) {
    return true;
  }
  try {
    const pathname = new URL(trimmed).pathname.replace(/\/+/g, '/').toLowerCase();
    return pathname.endsWith(DEFAULT_PROFILE_PLACEHOLDER_PATH);
  } catch {
    return /\/user\/no-image\.png(?:$|[?#])/i.test(trimmed);
  }
}

function sanitizeAvatarUrls(values: unknown[]): string[] {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => isValidHttpUrl(value) && !isPlaceholderProfileImageUrl(value));
}

async function fetchFromNetwork(): Promise<string[] | null> {
  try {
    const response = await fetch(getIntroAvatarUrl(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data: Array<{ profileImage: string }> = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const urls = sanitizeAvatarUrls(data.map((item) => item?.profileImage));
    return urls.length > 0 ? urls : null;
  } catch {
    return null;
  }
}

function getStorage(): Storage | null {
  // SSR-safe: localStorage isn't available on the server.
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function persistCache(urls: string[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload: CachedIntroAvatars = { urls, fetchedAt: Date.now() };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private-mode failures
  }
}

function readCache(): CachedIntroAvatars | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedIntroAvatars> | null;
    return {
      urls: sanitizeAvatarUrls(Array.isArray(parsed?.urls) ? parsed.urls : []),
      fetchedAt: typeof parsed?.fetchedAt === 'number' ? parsed.fetchedAt : 0,
    };
  } catch {
    return null;
  }
}

function padToCount(urls: (string | null)[]): (string | null)[] {
  const result = (urls ?? []).slice(0, INTRO_AVATAR_COUNT);
  while (result.length < INTRO_AVATAR_COUNT) result.push(null);
  return result;
}

/**
 * Returns exactly INTRO_AVATAR_COUNT entries — CDN URL strings or null. Caller
 * decides what to render in null slots (typically a bundled fallback image).
 * Always attempts a network refresh on cold start and falls back to cache when
 * needed. Mirrors the mobile semantics.
 */
export async function getCachedIntroAvatars(): Promise<(string | null)[]> {
  const cached = readCache();
  const fresh = await fetchFromNetwork();
  if (fresh && fresh.length > 0) {
    persistCache(fresh);
    return padToCount(fresh);
  }
  return cached ? padToCount(cached.urls) : [...EMPTY_AVATAR_SLOTS];
}

export const INTRO_AVATARS_STORAGE_KEY = STORAGE_KEY;
