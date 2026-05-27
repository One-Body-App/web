import { generateKeyPair, type ChatKeyPair } from './crypto';
import { chatApi } from '@/api/chat';

/**
 * Manages this browser's E2EE device keypair.
 *
 * NOTE: the private key lives in localStorage — adequate for a web client but
 * weaker than the mobile keychain. It registers under deviceId 'web' as its own
 * per-device record. Direct messages are encrypted to EVERY active device key
 * of both parties (see getDeviceKeys + the recipientEnvelopes fan-out in
 * Conversation), so a user with both a phone and web stays in sync — each
 * sender includes a per-device envelope for every device.
 */
const STORAGE_KEY = 'ob_chat_keypair_v1';
export const MY_DEVICE_ID = 'web';
export const MY_KEY_VERSION = 1;
const PEER_TTL_MS = 5 * 60 * 1000;

export interface PeerDeviceKey {
  deviceId: string;
  publicKey: string;
  keyVersion: number;
}

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
    keyVersion: MY_KEY_VERSION,
    deviceId: MY_DEVICE_ID,
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

const deviceKeysCache = new Map<string, { keys: PeerDeviceKey[]; ts: number }>();

/**
 * All active device keys for a user (the recipient or myself), used to build
 * per-device recipientEnvelopes. Best-effort: returns [] on failure so the
 * caller can still fall back to the single-key legacy path.
 */
export async function getDeviceKeys(userId: string): Promise<PeerDeviceKey[]> {
  const hit = deviceKeysCache.get(userId);
  if (hit && Date.now() - hit.ts < PEER_TTL_MS) return hit.keys;
  try {
    const keys = await chatApi.deviceKeys(userId);
    deviceKeysCache.set(userId, { keys, ts: Date.now() });
    return keys;
  } catch {
    return [];
  }
}
