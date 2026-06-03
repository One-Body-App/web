import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Copy, KeyRound, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { Splash } from '@/components/Splash';
import { AuthError, AuthSuccess, CodeInput, SubmitButton } from '@/components/auth/AuthControls';
import { useAccountProfileContext } from '../AccountProfileContext';
import { StepLayout } from '@/screens/onboarding/StepLayout';
import { MfaFallbackPanel } from './MfaFallbackPanel';
import { useMfaChallenge } from './useMfaChallenge';
import './secure-account.css';

/**
 * Passkey-first MFA enrollment / verification screen (route: /secure-account).
 * Leads with a single prominent passkey action; email / authenticator / backup
 * methods live behind a "Having trouble?" disclosure. When passkeys aren't
 * available the fallback opens automatically.
 */
export function SecureAccountScreen() {
  const { profile, refetch } = useAccountProfileContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLoginChallenge = searchParams.get('mode') === 'login';
  const handleComplete = useCallback(() => {
    refetch();
    if (isLoginChallenge) {
      navigate('/home', { replace: true });
    }
  }, [isLoginChallenge, navigate, refetch]);
  const controller = useMfaChallenge(handleComplete, {
    mode: isLoginChallenge ? 'login' : 'onboarding',
  });
  const [manualFallback, setManualFallback] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const {
    challenge,
    loading,
    submitting,
    error,
    backupCodes,
    passkeysSupported,
    methods,
    beginChallenge,
    selectedMethod,
    code,
    setCode,
    success,
    selectMethod,
    submitPasskey,
    submitMfa,
  } = controller;
  const canUseEmailFallback =
    isLoginChallenge && selectedMethod !== 'email' && methods.includes('email');
  const emailFallbackCopy =
    selectedMethod === 'totp'
      ? 'Having trouble with your authenticator app? Verify by email instead.'
      : 'Having trouble with your passkey? Verify by email instead.';
  const handleEmailFallback = useCallback(() => {
    if (!canUseEmailFallback) return;
    void selectMethod('email');
  }, [canUseEmailFallback, selectMethod]);

  const copyBackupCodes = useCallback(async () => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedBackup(true);
    } catch {
      setCopiedBackup(false);
    }
  }, [backupCodes]);

  if (loading) return <Splash label="Securing your account" />;

  const name = profile?.name ?? 'your account';

  // ---- Error: could not start the challenge ----
  if (!challenge) {
    return (
      <StepLayout
        icon={<ShieldCheck size={26} />}
        eyebrow="Account setup"
        title="Secure your account"
        subtitle="We could not start multi-factor setup. Try again to continue."
        error={error}
      >
        <SubmitButton type="button" onClick={beginChallenge}>
          Try again
        </SubmitButton>
      </StepLayout>
    );
  }

  // ---- Backup codes: shown once after enrollment ----
  if (backupCodes.length > 0) {
    return (
      <StepLayout
        icon={<ShieldCheck size={26} />}
        eyebrow="Account setup"
        title="Save your backup codes"
        subtitle="Keep these somewhere safe. Each code works once if you ever lose access to your passkey."
        error={error}
        footer={
          <SubmitButton loading={submitting} onClick={() => submitMfa()}>
            I saved my backup codes
          </SubmitButton>
        }
      >
        <p className="secure-account__backup-intro">They are shown only once.</p>
        <div className="mfa-backup-codes">
          {backupCodes.map((item) => (
            <code key={item}>{item}</code>
          ))}
        </div>
        <button type="button" className="secure-account__copy-all" onClick={copyBackupCodes}>
          {copiedBackup ? <Check size={16} /> : <Copy size={16} />}
          {copiedBackup ? 'Copied' : 'Copy all codes'}
        </button>
      </StepLayout>
    );
  }

  if (isLoginChallenge) {
    const loginTitle =
      selectedMethod === 'totp'
        ? 'Verify with your authenticator app'
        : selectedMethod === 'email'
          ? 'Verify your email'
          : 'Verify with your passkey';
    const loginSubtitle =
      selectedMethod === 'totp'
        ? 'Enter the code from your authenticator app to finish signing in.'
        : selectedMethod === 'email'
          ? `Enter the verification code sent to ${challenge.emailMasked}.`
          : 'Use the passkey you set up during account security to finish signing in.';
    const LoginIcon =
      selectedMethod === 'totp' ? Smartphone : selectedMethod === 'email' ? Mail : KeyRound;

    return (
      <StepLayout
        icon={<LoginIcon size={26} />}
        eyebrow="Secure sign-in"
        title={loginTitle}
        subtitle={loginSubtitle}
        error={error}
      >
        {selectedMethod === 'passkey' ? (
          <div className="secure-account__passkey">
            <div className="secure-account__passkey-art" aria-hidden>
              <KeyRound size={40} />
            </div>
            <p className="secure-account__device-note">
              Your device will ask for Face ID, Touch ID, or your screen lock.
            </p>
            {passkeysSupported ? (
              <SubmitButton
                type="button"
                loading={submitting}
                onClick={submitPasskey}
                className="btn btn--brand btn--block auth-submit secure-account__passkey-btn"
              >
                <KeyRound size={20} />
                Verify with your passkey
              </SubmitButton>
            ) : (
              <AuthError message="Passkeys are not supported in this browser." />
            )}
            {canUseEmailFallback ? (
              <button
                type="button"
                className="secure-account__fallback-toggle"
                onClick={handleEmailFallback}
              >
                {emailFallbackCopy}
              </button>
            ) : null}
          </div>
        ) : null}

        {selectedMethod === 'totp' ? (
          <form className="secure-account__login-form" onSubmit={submitMfa}>
            {success ? <AuthSuccess>{success}</AuthSuccess> : null}
            <CodeInput value={code} onChange={setCode} />
            <SubmitButton loading={submitting}>Verify</SubmitButton>
            {canUseEmailFallback ? (
              <button
                type="button"
                className="secure-account__fallback-toggle"
                onClick={handleEmailFallback}
              >
                {emailFallbackCopy}
              </button>
            ) : null}
          </form>
        ) : null}

        {selectedMethod === 'email' ? (
          <form className="secure-account__login-form" onSubmit={submitMfa}>
            {success ? <AuthSuccess>{success}</AuthSuccess> : null}
            <CodeInput value={code} onChange={setCode} />
            <SubmitButton loading={submitting}>Verify email</SubmitButton>
          </form>
        ) : null}
      </StepLayout>
    );
  }

  const hasPasskeyOption = passkeysSupported && methods.includes('passkey');
  const showFallback = manualFallback || !hasPasskeyOption;
  const passkeyPrimaryLabel = challenge.enrollmentRequired
    ? 'Create your passkey'
    : 'Verify with your passkey';

  return (
    <StepLayout
      icon={<ShieldCheck size={26} />}
      eyebrow="Account setup"
      title="Secure your account"
      subtitle={`Before entering One Body, ${name} needs multi-factor authentication.`}
      error={error}
    >
      {hasPasskeyOption ? (
        <div className="secure-account__passkey">
          <div className="secure-account__passkey-art" aria-hidden>
            <KeyRound size={40} />
          </div>
          <p className="secure-account__device-note">
            Passkeys are the safest way in. Your device will ask for Face ID, Touch ID, or your
            screen lock, no passwords to remember.
          </p>
          <SubmitButton
            type="button"
            loading={submitting}
            onClick={submitPasskey}
            className="btn btn--brand btn--block auth-submit secure-account__passkey-btn"
          >
            <KeyRound size={20} />
            {passkeyPrimaryLabel}
          </SubmitButton>

          {!showFallback ? (
            <button
              type="button"
              className="secure-account__fallback-toggle"
              onClick={() => setManualFallback(true)}
            >
              Having trouble? Use another method
            </button>
          ) : null}
        </div>
      ) : (
        <AuthError message="Passkeys aren't available in this browser. Use one of the methods below." />
      )}

      {showFallback ? <MfaFallbackPanel controller={controller} /> : null}
    </StepLayout>
  );
}
