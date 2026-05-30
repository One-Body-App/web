import { useState } from 'react';
import {
  TURNSTILE_SITE_KEY_CONFIGURED,
  verifyTurnstileTokenWithApi,
} from '@/components/turnstile';

type AuthTurnstileAction = 'auth-sign-in' | 'auth-sign-up';

export function useTurnstileVerification(onFailure: (message: string) => void) {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const clear = () => setToken(null);
  const reset = () => {
    if (!TURNSTILE_SITE_KEY_CONFIGURED) return;
    setToken(null);
    setResetKey((key) => key + 1);
  };

  const verify = async (action: AuthTurnstileAction) => {
    if (!TURNSTILE_SITE_KEY_CONFIGURED) return true;
    if (!token) {
      onFailure('Please complete the security check.');
      return false;
    }

    const currentToken = token;
    reset();
    const verified = await verifyTurnstileTokenWithApi(currentToken, { action });
    if (!verified) {
      onFailure('Security check failed. Please try again.');
    }
    return verified;
  };

  return {
    clear,
    enabled: TURNSTILE_SITE_KEY_CONFIGURED,
    handleVerify: setToken,
    passed: !TURNSTILE_SITE_KEY_CONFIGURED || Boolean(token),
    resetKey,
    verify,
  };
}
