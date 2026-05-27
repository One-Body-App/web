import { generateKeyPair, type ChatKeyPair } from './crypto';
import { chatApi } from '@/api/chat';

/**
 * Manages this browser's E2EE device keypair.
 *
 * NOTE: the private key lives in localStorage — adequate for a web client but
 * weaker than the mobile keychain. It registers under deviceId 'web' (its own
 * record), but the peer-key fetch returns a single active key, so a user with
 * BOTH a phone and web key shares the single-active-key limitation that already
 * exists on mobile (multi-device key fan-out is a separate server enhancement).
 */
const STORAGE_KEY = 'ob_chat_keypair_v1';
const DEVICE_ID = 'web';
const KEY_VERSION = 1;
const PEER_TTL_MS = 5 * 60 * 1000;

let cached: ChatKeyPair | null = null;
let registered = false;
const peerCache = new Map<string, { publicKey: string; ts: number }>();

export async function getMyKeypair(): Promise<ChatKeyPair> {
  if (cached) return cached;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as ChatKeyPair;
      if (parsed?.publicKey && parsed?.privateKey) {
        cached = parsed;
        return cached;
      }
    } catch {
      /* regenerate below */
    }
  }
  const kp = await generateKeyPair();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kp));
  cached = kp;
  return kp;
}

/** Registers this device's public key with the server (once per session). */
export async function ensureKeyRegistered(): Promise<void> {
  if (registered) return;
  const kp = await getMyKeypair();
  await chatApi.registerKey({
    publicKey: kp.publicKey,
    algorithm: 'x25519',
    keyVersion: KEY_VERSION,
    deviceId: DEVICE_ID,
  });
  registered = true;
}

export async function getPeerPublicKey(userId: string): Promise<string | null> {
  const hit = peerCache.get(userId);
  if (hit && Date.now() - hit.ts < PEER_TTL_MS) return hit.publicKey;
  const key = await chatApi.peerKey(userId);
  if (key?.publicKey) {
    peerCache.set(userId, { publicKey: key.publicKey, ts: Date.now() });
    return key.publicKey;
  }
  return null;
}
