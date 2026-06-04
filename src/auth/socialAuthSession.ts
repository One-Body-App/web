import type { AccountType } from '@/components/auth/AuthControls';

type SocialStrategy = 'oauth_google' | 'oauth_apple';

type PendingSocialAuth = {
  strategy: SocialStrategy;
  accountType?: AccountType;
  createdAt: number;
};

type ActiveSocialAuth = PendingSocialAuth & {
  sessionId: string;
};

const PENDING_KEY = 'onebody.socialAuth.pending';
const ACTIVE_KEY = 'onebody.socialAuth.active';
const PENDING_TTL_MS = 10 * 60 * 1000;
const ACTIVE_TTL_MS = 24 * 60 * 60 * 1000;

function getSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
}

function remove(key: string) {
  getSessionStorage()?.removeItem(key);
}

function isFresh(createdAt: number, ttlMs: number) {
  return Number.isFinite(createdAt) && Date.now() - createdAt <= ttlMs;
}

export function markPendingSocialAuth(strategy: SocialStrategy, accountType?: AccountType | null) {
  writeJson(PENDING_KEY, {
    strategy,
    ...(accountType ? { accountType } : {}),
    createdAt: Date.now(),
  } satisfies PendingSocialAuth);
}

export function getPendingSocialAuth(): PendingSocialAuth | null {
  const pending = readJson<PendingSocialAuth>(PENDING_KEY);
  if (!pending || !isFresh(pending.createdAt, PENDING_TTL_MS)) {
    remove(PENDING_KEY);
    return null;
  }
  return pending;
}

export function clearPendingSocialAuth() {
  remove(PENDING_KEY);
}

export function clearActiveSocialAuth() {
  remove(ACTIVE_KEY);
}

export function clearSocialAuthMarkers() {
  clearPendingSocialAuth();
  clearActiveSocialAuth();
}

export function promotePendingSocialAuth(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  const pending = getPendingSocialAuth();
  if (!pending) return false;
  writeJson(ACTIVE_KEY, {
    ...pending,
    sessionId,
    createdAt: Date.now(),
  } satisfies ActiveSocialAuth);
  clearPendingSocialAuth();
  return true;
}

export function isActiveSocialAuthSession(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  const active = readJson<ActiveSocialAuth>(ACTIVE_KEY);
  if (!active || !isFresh(active.createdAt, ACTIVE_TTL_MS)) {
    clearActiveSocialAuth();
    return false;
  }
  if (active.sessionId !== sessionId) return false;
  return true;
}
