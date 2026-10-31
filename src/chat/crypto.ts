import nacl from 'tweetnacl';

/**
 * Interoperable with the mobile app's libsodium chat crypto. `nacl.box` is the
 * same NaCl primitive as libsodium `crypto_box` (X25519 + XSalsa20-Poly1305),
 * so ciphertexts are byte-compatible across the two libraries. Base64 uses the
 * standard padded alphabet (libsodium `base64_variants.ORIGINAL`). Text messages
 * encrypt the raw string; media uses a typed JSON envelope (see parsePlaintext).
 */
export const BOX_SCHEME = 'box:v1';

// Standard base64 WITH padding — matches libsodium base64_variants.ORIGINAL.
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

const utf8Encode = new TextEncoder();
const utf8Decode = new TextDecoder();

export interface ChatKeyPair {
  publicKey: string;
  privateKey: string;
}

export function isValidKeyPair(pair: ChatKeyPair): boolean {
  try {
    const derived = nacl.box.keyPair.fromSecretKey(fromBase64(pair.privateKey));
    return toBase64(derived.publicKey) === pair.publicKey;
  } catch { return false; }
}

export function generateKeyPair(): ChatKeyPair {
  const kp = nacl.box.keyPair();
  return { publicKey: toBase64(kp.publicKey), privateKey: toBase64(kp.secretKey) };
}

export interface EncryptedEnvelope {
  encryptedPayload: string;
  nonce: string;
  authTag: string;
}

/** Encrypts plaintext to a peer using my private key (NaCl box). */
export function encrypt(
  plaintext: string,
  myPrivateKeyB64: string,
  peerPublicKeyB64: string,
): EncryptedEnvelope {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const cipher = nacl.box(
    utf8Encode.encode(plaintext),
    nonce,
    fromBase64(peerPublicKeyB64),
    fromBase64(myPrivateKeyB64),
  );
  return { encryptedPayload: toBase64(cipher), nonce: toBase64(nonce), authTag: BOX_SCHEME };
}

/**
 * Decrypts a direct message. NaCl box is symmetric over the DH shared secret,
 * so the SAME call (peer public key + my private key) opens both messages I
 * received from the peer AND messages I sent to them. Returns null on failure.
 */
export function decrypt(
  encryptedPayloadB64: string,
  nonceB64: string,
  peerPublicKeyB64: string,
  myPrivateKeyB64: string,
): string | null {
  try {
    const opened = nacl.box.open(
      fromBase64(encryptedPayloadB64),
      fromBase64(nonceB64),
      fromBase64(peerPublicKeyB64),
      fromBase64(myPrivateKeyB64),
    );
    return opened ? utf8Decode.decode(opened) : null;
  } catch {
    return null;
  }
}

export interface ParsedMessage {
  type: 'text' | 'image' | 'gif' | 'images';
  text: string;
  mediaUrl?: string;
  mediaUrls?: string[];
}

/** Mirrors the mobile `parseChatMessagePayload`: typed JSON envelope or raw text. */
export function parsePlaintext(plaintext: string): ParsedMessage {
  try {
    const parsed = JSON.parse(plaintext);
    if (parsed && typeof parsed === 'object' && parsed.type) {
      if (parsed.type === 'image' && parsed.url) {
        return { type: 'image', text: typeof parsed.text === 'string' ? parsed.text : '', mediaUrl: String(parsed.url) };
      }
      if (parsed.type === 'gif' && parsed.giphyId) {
        return {
          type: 'gif',
          text: typeof parsed.text === 'string' ? parsed.text : '',
          mediaUrl: `https://media.giphy.com/media/${parsed.giphyId}/giphy.gif`,
        };
      }
      if (parsed.type === 'images' && Array.isArray(parsed.urls)) {
        return {
          type: 'images',
          text: typeof parsed.text === 'string' ? parsed.text : '',
          mediaUrls: parsed.urls.flatMap((u: unknown) => {
            const url = String(u || '').trim();
            return url ? [url] : [];
          }),
        };
      }
    }
  } catch {
    /* not JSON — treat as plain text */
  }
  return { type: 'text', text: plaintext };
}
