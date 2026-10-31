import { describe, expect, it } from 'vitest';
import { generateKeyPair, encrypt, decrypt } from './crypto';
import { openVault, sealVault, type VaultContents } from './vault';
const secret = 'a separate long chat passphrase';
const contents: VaultContents = { ...generateKeyPair(), deviceId: 'device-a', keyVersion: 1, owner: 'alice', retired: [] };

describe('encrypted chat vault', () => {
  it('persists ciphertext only and preserves box:v1 history through unlock', async () => {
    const peer = generateKeyPair();
    const message = encrypt('old message', peer.privateKey, contents.publicKey);
    const sealed = await sealVault(contents, secret, 'api|alice');
    expect(sealed).not.toContain(contents.privateKey);
    expect(sealed).not.toContain(secret);
    const restored = await openVault(sealed, secret, 'api|alice');
    expect(decrypt(message.encryptedPayload, message.nonce, peer.publicKey, restored.privateKey)).toBe('old message');
  });
  it('uses fresh salt and nonce, and refuses a wrong passphrase or different account/environment', async () => {
    const a = await sealVault(contents, secret, 'api|alice');
    const b = await sealVault(contents, secret, 'api|alice');
    expect(JSON.parse(a).salt).not.toBe(JSON.parse(b).salt);
    expect(JSON.parse(a).iv).not.toBe(JSON.parse(b).iv);
    await expect(openVault(a, 'wrong', 'api|alice')).rejects.toThrow('not been changed');
    await expect(openVault(a, secret, 'api|bob')).rejects.toThrow();
    await expect(openVault(a, secret, 'other-api|alice')).rejects.toThrow();
  });
  it('rejects tampering, unsupported work factors, and short new passphrases', async () => {
    const record = JSON.parse(await sealVault(contents, secret, 'api|alice'));
    await expect(openVault(JSON.stringify({ ...record, iterations: 1 }), secret, 'api|alice')).rejects.toThrow();
    record.ciphertext = `AAAA${record.ciphertext.slice(4)}`;
    await expect(openVault(JSON.stringify(record), secret, 'api|alice')).rejects.toThrow();
    await expect(sealVault(contents, 'short', 'api|alice')).rejects.toThrow('12');
  });
});
