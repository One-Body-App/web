import { useCallback, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toDataURL } from 'qrcode';
import { ApiError } from '@/api/client';
import {
  endpoints,
  type AuthApiResult,
  type MfaChallengeResponse,
  type MfaMethod,
} from '@/api/endpoints';
import { createPasskeyCredential, getPasskeyCredential, isWebAuthnSupported } from '../webauthn';

/**
 * Headless MFA challenge controller. The behaviour here is lifted verbatim from
 * the original inline `MfaGate` in RequireAccountReady.tsx — only the rendering
 * was pulled out into SecureAccountScreen / MfaFallbackPanel. All endpoint and
 * WebAuthn calls are unchanged.
 */

function isMfaChallengeResponse(
  response: MfaChallengeResponse | { mfaRequired: false },
): response is MfaChallengeResponse {
  return response.mfaRequired === true;
}

function resolveInitialMfaMethod(challenge: MfaChallengeResponse): MfaMethod {
  if (challenge.enrollmentRequired && challenge.availableMethods.includes('passkey')) {
    return 'passkey';
  }
  if (challenge.availableMethods.includes(challenge.preferredMethod)) {
    return challenge.preferredMethod;
  }
  return challenge.availableMethods[0] ?? 'email';
}

function extractTotpSetupCode(otpauthUri: string): string {
  const match = otpauthUri.match(/[?&]secret=([^&]+)/i);
  if (!match?.[1]) return otpauthUri;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function createTotpQrDataUrl(otpauthUri: string): Promise<string> {
  if (!otpauthUri) return '';

  try {
    return await toDataURL(otpauthUri, {
      color: {
        dark: '#0f172aff',
        light: '#ffffffff',
      },
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
    });
  } catch {
    return '';
  }
}

export function mfaMethodLabel(method: MfaMethod): string {
  if (method === 'passkey') return 'Passkey';
  if (method === 'totp') return 'Authenticator';
  if (method === 'backup') return 'Backup code';
  return 'Email';
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export interface MfaChallengeController {
  challenge: MfaChallengeResponse | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  success: ReactNode | null;
  selectedMethod: MfaMethod;
  code: string;
  setCode: (value: string) => void;
  totpOtpauth: string;
  totpQrDataUrl: string;
  totpSetupCode: string;
  backupCodes: string[];
  passkeysSupported: boolean;
  methods: MfaMethod[];
  isTotpEnrollmentPending: boolean;
  isTotpEnrollmentReady: boolean;
  showCodeInput: boolean;
  beginChallenge: () => Promise<void>;
  selectMethod: (method: MfaMethod) => Promise<void>;
  submitPasskey: () => Promise<void>;
  submitMfa: (event?: FormEvent) => Promise<void>;
  copyTotpSetupCode: () => Promise<void>;
}

export function useMfaChallenge(onComplete: () => void): MfaChallengeController {
  const [challenge, setChallenge] = useState<MfaChallengeResponse | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MfaMethod>('passkey');
  const [code, setCode] = useState('');
  const [totpOtpauth, setTotpOtpauth] = useState('');
  const [totpQrDataUrl, setTotpQrDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ReactNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const challengeStartedRef = useRef(false);
  const passkeysSupported = isWebAuthnSupported();

  const beginChallenge = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setBackupCodes([]);
    setTotpOtpauth('');
    setTotpQrDataUrl('');
    setCode('');
    try {
      const response = await endpoints.beginMfaOnboarding();
      if (!isMfaChallengeResponse(response)) {
        onComplete();
        return;
      }

      const preferredMethod = resolveInitialMfaMethod(response);
      const supportedMethod =
        preferredMethod === 'passkey' && !passkeysSupported
          ? response.availableMethods.find((method) => method !== 'passkey') ?? preferredMethod
          : preferredMethod;

      setChallenge(response);
      setSelectedMethod(supportedMethod);
    } catch (err) {
      setChallenge(null);
      setError(apiErrorMessage(err, 'Unable to start multi-factor authentication.'));
    } finally {
      setLoading(false);
    }
  }, [onComplete, passkeysSupported]);

  // Kick off the challenge once on first render (no useEffect per project rule).
  if (!challengeStartedRef.current) {
    challengeStartedRef.current = true;
    void beginChallenge();
  }

  const completeAuthResult = useCallback(
    (result: AuthApiResult) => {
      const codes = Array.isArray(result.backupCodes)
        ? result.backupCodes.filter((item): item is string => typeof item === 'string')
        : [];

      if (codes.length > 0) {
        setBackupCodes(codes);
        setSuccess('Save these backup codes in a safe place. They are shown only once.');
        return;
      }

      onComplete();
    },
    [onComplete],
  );

  const beginTotpEnrollment = useCallback(async () => {
    if (!challenge || !challenge.enrollmentRequired) return false;
    if (totpOtpauth) return true;

    const begin = await endpoints.beginTotpSetup({ mfaToken: challenge.mfaToken });
    const qrDataUrl = await createTotpQrDataUrl(begin.otpauth);
    setTotpOtpauth(begin.otpauth);
    setTotpQrDataUrl(qrDataUrl);
    setSuccess('Scan the QR code or enter the setup code, then enter the 6-digit code.');
    return true;
  }, [challenge, totpOtpauth]);

  const selectMethod = useCallback(
    async (method: MfaMethod) => {
      if (!challenge || submitting) return;
      setSelectedMethod(method);
      setCode('');
      setError(null);
      setSuccess(null);

      if (method === 'totp' && challenge.enrollmentRequired && !totpOtpauth) {
        setSubmitting(true);
        try {
          await beginTotpEnrollment();
        } catch (err) {
          setError(apiErrorMessage(err, 'Unable to begin authenticator setup.'));
        } finally {
          setSubmitting(false);
        }
        return;
      }

      if (method === 'email' && !challenge.enrollmentRequired) {
        setSubmitting(true);
        try {
          await endpoints.sendEmailMfaCode({ mfaToken: challenge.mfaToken });
          setSuccess(`A verification code was sent to ${challenge.emailMasked}.`);
        } catch (err) {
          setError(apiErrorMessage(err, 'Unable to send email verification code.'));
        } finally {
          setSubmitting(false);
        }
      }
    },
    [beginTotpEnrollment, challenge, submitting, totpOtpauth],
  );

  const runPasskey = useCallback(async () => {
    if (!challenge) return;
    if (!passkeysSupported) {
      setError('Passkeys are not supported in this browser. Choose another method.');
      return;
    }

    if (challenge.enrollmentRequired) {
      const begin = await endpoints.beginPasskeyRegistration({
        mfaToken: challenge.mfaToken,
        deviceName: navigator.platform || 'Web browser',
      });
      const credential = await createPasskeyCredential(begin);
      const finish = await endpoints.finishPasskeyRegistration({
        mfaToken: challenge.mfaToken,
        response: credential,
      });
      completeAuthResult(finish);
      return;
    }

    const begin = await endpoints.beginPasskeyLogin({ mfaToken: challenge.mfaToken });
    const credential = await getPasskeyCredential(begin);
    const finish = await endpoints.finishPasskeyLogin({
      mfaToken: challenge.mfaToken,
      response: credential,
    });
    completeAuthResult(finish);
  }, [challenge, completeAuthResult, passkeysSupported]);

  // Passkey-first primary action. Runs the passkey flow regardless of any
  // fallback method the user may have selected, with the shared submit wrapper.
  const submitPasskey = useCallback(async () => {
    if (!challenge || submitting) return;
    setSelectedMethod('passkey');
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await runPasskey();
    } catch (err) {
      setError(apiErrorMessage(err, 'Passkey authentication failed.'));
    } finally {
      setSubmitting(false);
    }
  }, [challenge, runPasskey, submitting]);

  const submitMfa = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (!challenge || submitting) return;

      if (backupCodes.length > 0) {
        onComplete();
        return;
      }

      setSubmitting(true);
      setError(null);
      setSuccess(null);
      try {
        if (selectedMethod === 'passkey') {
          await runPasskey();
          return;
        }

        if (selectedMethod === 'email' && challenge.enrollmentRequired) {
          const result = await endpoints.verifyEmailMfaCode({
            mfaToken: challenge.mfaToken,
            code: '',
          });
          completeAuthResult(result);
          return;
        }

        if (selectedMethod === 'totp' && challenge.enrollmentRequired && !totpOtpauth) {
          await beginTotpEnrollment();
          return;
        }

        if (!code.trim()) {
          setError('Enter your verification code.');
          return;
        }

        if (selectedMethod === 'totp') {
          if (challenge.enrollmentRequired) {
            const result = await endpoints.verifyTotpSetup({
              mfaToken: challenge.mfaToken,
              code: code.trim(),
            });
            completeAuthResult(result);
            return;
          }

          const result = await endpoints.verifyTotpCode({
            mfaToken: challenge.mfaToken,
            code: code.trim(),
          });
          completeAuthResult(result);
          return;
        }

        if (selectedMethod === 'backup') {
          const result = await endpoints.verifyBackupCode({
            mfaToken: challenge.mfaToken,
            code: code.trim(),
          });
          completeAuthResult(result);
          return;
        }

        const result = await endpoints.verifyEmailMfaCode({
          mfaToken: challenge.mfaToken,
          code: code.trim(),
        });
        completeAuthResult(result);
      } catch (err) {
        setError(apiErrorMessage(err, 'Multi-factor verification failed.'));
      } finally {
        setSubmitting(false);
      }
    },
    [
      backupCodes.length,
      beginTotpEnrollment,
      challenge,
      code,
      completeAuthResult,
      onComplete,
      runPasskey,
      selectedMethod,
      submitting,
      totpOtpauth,
    ],
  );

  const methods = challenge?.availableMethods ?? [];
  const isTotpEnrollmentPending =
    !!challenge && selectedMethod === 'totp' && challenge.enrollmentRequired && !totpOtpauth;
  const isTotpEnrollmentReady =
    !!challenge && selectedMethod === 'totp' && challenge.enrollmentRequired && !!totpOtpauth;
  const showCodeInput =
    !!challenge &&
    selectedMethod !== 'passkey' &&
    !(selectedMethod === 'email' && challenge.enrollmentRequired) &&
    !isTotpEnrollmentPending;
  const totpSetupCode = useMemo(() => extractTotpSetupCode(totpOtpauth), [totpOtpauth]);

  const copyTotpSetupCode = useCallback(async () => {
    if (!totpSetupCode) return;
    if (!navigator.clipboard?.writeText) {
      setError('Copy is not available in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(totpSetupCode);
      setError(null);
      setSuccess('Setup code copied.');
    } catch {
      setError('Unable to copy setup code.');
    }
  }, [totpSetupCode]);

  return {
    challenge,
    loading,
    submitting,
    error,
    success,
    selectedMethod,
    code,
    setCode,
    totpOtpauth,
    totpQrDataUrl,
    totpSetupCode,
    backupCodes,
    passkeysSupported,
    methods,
    isTotpEnrollmentPending,
    isTotpEnrollmentReady,
    showCodeInput,
    beginChallenge,
    selectMethod,
    submitPasskey,
    submitMfa,
    copyTotpSetupCode,
  };
}
