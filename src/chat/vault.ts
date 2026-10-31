import { isValidKeyPair, type ChatKeyPair } from './crypto';

export type DeviceKey = ChatKeyPair & { deviceId: string; keyVersion: number };
export type VaultContents = DeviceKey & { owner: string; retired: DeviceKey[] };
const ITERATIONS = 600_000;
const encode = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

async function derive(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encode.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function sealVault(contents: VaultContents, passphrase: string, scope: string): Promise<string> {
  if (passphrase.length < 12) throw new Error('Use a chat passphrase of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encode.encode(scope), tagLength: 128 },
    key, encode.encode(JSON.stringify(contents)),
  );
  return JSON.stringify({ v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext)) });
}

export async function openVault(record: string, passphrase: string, scope: string): Promise<VaultContents> {
  try {
    if (record.length > 100_000) throw new Error();
    const data = JSON.parse(record);
    if (data.v !== 1 || data.iterations !== ITERATIONS) throw new Error();
    const salt = unb64(data.salt), iv = unb64(data.iv), ciphertext = unb64(data.ciphertext);
    if (salt.length !== 16 || iv.length !== 12) throw new Error();
    const key = await derive(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: encode.encode(scope), tagLength: 128 }, key, ciphertext,
    );
    const contents = JSON.parse(new TextDecoder().decode(plaintext)) as VaultContents;
    if (!contents.owner || !Array.isArray(contents.retired) || contents.retired.length > 20 ||
      ![contents, ...contents.retired].every(k => k.deviceId && k.keyVersion > 0 &&
        isValidKeyPair(k))) throw new Error();
    return contents;
  } catch {
    throw new Error('Unable to unlock chat. Check your passphrase. Your saved vault has not been changed.');
  }
}
