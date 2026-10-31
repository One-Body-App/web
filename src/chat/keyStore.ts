import { generateKeyPair, isValidKeyPair } from './crypto';
import { chatApi } from '@/api/chat';
import { API_BASE_URL } from '@/api/config';
import { disconnectChatSocket } from './socket';
import { openVault, sealVault, type VaultContents } from './vault';

const LEGACY_KEY = 'ob_chat_keypair_v1';
const PEER_TTL_MS = 5 * 60 * 1000;
export interface PeerDeviceKey { deviceId: string; publicKey: string; keyVersion: number }
let identity: string | null = null;
let scope = '';
let revision = 0;
let cached: VaultContents | null = null;
let registered = false;
let unlocking = false;
const listeners = new Set<() => void>();
const peerCache = new Map<string, { publicKey: string; ts: number }>();
const deviceKeysCache = new Map<string, { keys: PeerDeviceKey[]; ts: number }>();
const emit = () => listeners.forEach(listener => listener());
const assertCurrent = (expected: number) => {
  if (!identity || revision !== expected) throw new Error('Chat account changed. Unlock chat again.');
};
const storageKey = () => `ob_chat_vault_v1:${scope}`;
export const subscribeVault = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const isVaultUnlocked = () => cached !== null && registered;
export const getChatIdentity = () => identity;
export const hasSavedVault = () => Boolean(identity && localStorage.getItem(storageKey()));

export function lockChatVault() {
  revision++;
  cached = null;
  registered = false;
  unlocking = false;
  peerCache.clear();
  deviceKeysCache.clear();
  disconnectChatSocket();
  emit();
}
export function setChatIdentity(next: string | null) {
  if (identity === next) return;
  lockChatVault();
  identity = next;
  scope = `${API_BASE_URL}|${next ?? ''}`;
  emit();
}

/** Persist before registration. A failed request can be retried without replacing keys. */
export async function unlockChatVault(passphrase: string, recoveryPassphrase?: string): Promise<void> {
  if (!navigator.locks) throw new Error('This browser needs Web Locks support to safely store chat history.');
  const expected = revision;
  return navigator.locks.request(storageKey(), () => {
    assertCurrent(expected);
    return unlockExclusive(passphrase, recoveryPassphrase);
  });
}
async function unlockExclusive(passphrase: string, recoveryPassphrase?: string): Promise<void> {
  if (!identity || unlocking) throw new Error('Chat is unavailable or already unlocking.');
  unlocking = true;
  const expected = revision;
  const key = storageKey();
  const vaultScope = scope;
  try {
    const own = await chatApi.ownKeys();
    assertCurrent(expected);
    const saved = localStorage.getItem(key);
    let contents: VaultContents;
    let migrated = false;
    if (saved) {
      contents = await openVault(saved, passphrase, vaultScope);
      if (contents.owner !== own.userId) throw new Error('This vault belongs to another account.');
    } else {
      const archiveScope = `${API_BASE_URL}|legacy-chat-archive`;
      const archiveKey = `ob_chat_legacy_archive_v1:${API_BASE_URL}`;
      const archive = localStorage.getItem(archiveKey);
      const legacy = localStorage.getItem(LEGACY_KEY);
      const retired: VaultContents['retired'] = [];
      if (legacy) {
        // Unknown ownership is quarantined, never assigned to the next login.
        const old = JSON.parse(legacy);
        const matches = own.keys.filter(k => k.publicKey === old.publicKey);
        if (matches.length) {
          if (!isValidKeyPair(old)) throw new Error('The old chat key needs recovery.');
          retired.push(...matches.map(k => ({ ...k, privateKey: old.privateKey })));
          migrated = true;
        }
      }
      if (!legacy && archive) {
        const old = await openVault(archive, recoveryPassphrase || passphrase, archiveScope);
        for (const key of [old, ...old.retired]) {
          if (own.keys.some(k => k.publicKey === key.publicKey && k.deviceId === key.deviceId)) {
            if (!retired.some(k => k.deviceId === key.deviceId)) retired.push(key);
          }
        }
      }
      contents = { ...generateKeyPair(), deviceId: `web-${crypto.randomUUID()}`, keyVersion: 1, owner: own.userId, retired };
      const encrypted = await sealVault(contents, passphrase, vaultScope);
      assertCurrent(expected);
      // A second tab must not silently overwrite a newly created vault.
      if (localStorage.getItem(key)) throw new Error('Chat was set up in another tab. Unlock again.');
      // Keep an encrypted migration archive so a second verified account that
      // shared the old key can recover its history with the old passphrase.
      if (migrated && !archive) {
        const encryptedArchive = await sealVault({ ...retired[0], owner: own.userId, retired: retired.slice(1) }, passphrase, archiveScope);
        assertCurrent(expected);
        localStorage.setItem(archiveKey, encryptedArchive);
      }
      localStorage.setItem(key, encrypted);
      if (migrated) localStorage.removeItem(LEGACY_KEY);
    }
    assertCurrent(expected);
    await chatApi.registerKey({ publicKey: contents.publicKey, algorithm: 'x25519', keyVersion: contents.keyVersion,
      deviceId: contents.deviceId, retireDeviceIds: contents.retired.map(k => k.deviceId) });
    assertCurrent(expected);
    cached = contents;
    registered = true;
    emit();
  } finally {
    if (revision === expected) unlocking = false;
  }
}

export async function getMyKeypair(): Promise<VaultContents> {
  if (!cached || !registered) throw new Error('Unlock your chat vault first.');
  return cached;
}
export async function ensureKeyRegistered(): Promise<void> { await getMyKeypair(); }
export async function getPeerPublicKey(userId: string): Promise<string | null> {
  const expected = revision;
  const hit = peerCache.get(userId);
  if (hit && Date.now() - hit.ts < PEER_TTL_MS) return hit.publicKey;
  const key = await chatApi.peerKey(userId);
  assertCurrent(expected);
  if (key?.publicKey) { peerCache.set(userId, { publicKey: key.publicKey, ts: Date.now() }); return key.publicKey; }
  return null;
}
export async function getDeviceKeys(userId: string, includeRetired = false): Promise<PeerDeviceKey[]> {
  const expected = revision;
  const cacheKey = `${userId}:${includeRetired}`;
  const hit = deviceKeysCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < PEER_TTL_MS) return hit.keys;
  const keys = cached?.owner === userId
    ? (await chatApi.ownKeys()).keys.filter(key => includeRetired || key.isActive !== false)
    : await chatApi.deviceKeys(userId, includeRetired);
  assertCurrent(expected);
  deviceKeysCache.set(cacheKey, { keys, ts: Date.now() });
  return keys;
}
