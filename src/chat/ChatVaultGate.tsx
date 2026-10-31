import { useCallback, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { getChatIdentity, hasSavedVault, isVaultUnlocked, lockChatVault, setChatIdentity, subscribeVault, unlockChatVault } from './keyStore';

/** The keyed auth boundary unmounts plaintext UI and clears active keys on account/session changes. */
export function ChatAccountBoundary({ identity, children }: { identity: string | null; children: ReactNode }) {
  const subscribe = useCallback((listener: () => void) => {
    const unsubscribe = subscribeVault(listener);
    setChatIdentity(identity);
    listener();
    return () => { unsubscribe(); setChatIdentity(null); };
  }, [identity]);
  const ready = useSyncExternalStore(subscribe, () => getChatIdentity() === identity, () => false);
  return <>{ready ? children : null}</>;
}

export function ChatVaultGate({ children }: { children: ReactNode }) {
  const unlocked = useSyncExternalStore(subscribeVault, isVaultUnlocked, () => false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recovery, setRecovery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const exists = hasSavedVault();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!exists && passphrase !== confirmation) { setError('Passphrases do not match.'); return; }
    setBusy(true);
    setError('');
    try { await unlockChatVault(passphrase, recovery || undefined); setPassphrase(''); setConfirmation(''); setRecovery(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to unlock chat.'); }
    finally { setBusy(false); }
  }
  if (unlocked) return <><button type="button" onClick={lockChatVault}>Lock chat</button>{children}</>;
  return <section className="chat-vault" style={{ maxWidth: 480, margin: '3rem auto', padding: 24 }}>
    <h1>{exists ? 'Unlock your chat history' : 'Protect your chat history'}</h1>
    <p>Your chat passphrase is separate from your account password. Keep it in a password manager.
      If you forget it or clear browser storage, this browser cannot recover its encrypted history.</p>
    <form onSubmit={submit}>
      <label htmlFor="chat-passphrase">Chat passphrase</label>
      <input id="chat-passphrase" type="password" autoComplete={exists ? 'current-password' : 'new-password'}
        minLength={12} required value={passphrase} onChange={e => setPassphrase(e.target.value)} />
      {!exists && <><label htmlFor="chat-confirmation">Confirm passphrase</label>
        <input id="chat-confirmation" type="password" autoComplete="new-password" required
          value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        <details><summary>Recover history from another account on this browser</summary>
          <label htmlFor="chat-recovery">Previous chat passphrase (if different)</label>
          <input id="chat-recovery" type="password" autoComplete="current-password" value={recovery} onChange={e => setRecovery(e.target.value)} />
        </details></>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Unlocking...' : exists ? 'Unlock chat' : 'Create encrypted vault'}</button>
    </form>
  </section>;
}
