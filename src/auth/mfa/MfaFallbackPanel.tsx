import { ChevronRight, Copy, ExternalLink, KeyRound, Mail, Smartphone } from 'lucide-react';
import { AuthSuccess, CodeInput, SubmitButton } from '@/components/auth/AuthControls';
import type { MfaMethod } from '@/api/endpoints';
import { mfaMethodLabel, type MfaChallengeController } from './useMfaChallenge';

function methodHint(method: MfaMethod): string {
  if (method === 'totp') return 'Use a code from your authenticator app';
  if (method === 'email') return 'Send a code to your verified email';
  return 'Use your device passkey';
}

function MfaMethodRow({
  disabled,
  method,
  onClick,
  selected,
}: {
  disabled?: boolean;
  method: MfaMethod;
  onClick: () => void;
  selected: boolean;
}) {
  const Icon = method === 'passkey' ? KeyRound : method === 'totp' ? Smartphone : Mail;
  return (
    <button
      type="button"
      className={`mfa-method-row${selected ? ' is-selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
      {...{ 'aria-pressed': selected ? 'true' : 'false' }}
    >
      <span className="mfa-method-row__icon" aria-hidden>
        <Icon size={20} />
      </span>
      <span className="mfa-method-row__text">
        <strong>{mfaMethodLabel(method)}</strong>
        <span>{methodHint(method)}</span>
      </span>
      <ChevronRight size={18} className="mfa-method-row__chevron" aria-hidden />
    </button>
  );
}

function submitLabel(controller: MfaChallengeController): string {
  const { challenge, selectedMethod, totpOtpauth } = controller;
  if (selectedMethod === 'email' && challenge?.enrollmentRequired) return 'Use Verified Email';
  if (selectedMethod === 'totp' && challenge?.enrollmentRequired && !totpOtpauth) {
    return 'Set Up Authenticator';
  }
  return 'Verify';
}

/**
 * The non-passkey MFA methods (email / authenticator / backup), revealed under
 * the "Having trouble?" disclosure on SecureAccountScreen. UI is lifted from the
 * original inline MfaGate; all behaviour comes from the shared controller.
 */
export function MfaFallbackPanel({ controller }: { controller: MfaChallengeController }) {
  const {
    challenge,
    success,
    selectedMethod,
    code,
    setCode,
    totpOtpauth,
    totpQrDataUrl,
    totpSetupCode,
    submitting,
    methods,
    isTotpEnrollmentPending,
    isTotpEnrollmentReady,
    showCodeInput,
    selectMethod,
    submitMfa,
    copyTotpSetupCode,
  } = controller;

  if (!challenge) return null;

  // Passkey is the hero action; the fallback offers the remaining methods.
  const fallbackMethods = methods.filter((method) => method !== 'passkey');

  return (
    <form className="secure-account__fallback" onSubmit={submitMfa}>
      <p className="secure-account__fallback-head">Verify another way</p>

      {success ? <AuthSuccess>{success}</AuthSuccess> : null}

      <div className="mfa-method-list">
        {fallbackMethods.map((method) => (
          <MfaMethodRow
            key={method}
            method={method}
            selected={selectedMethod === method}
            disabled={submitting}
            onClick={() => selectMethod(method)}
          />
        ))}
      </div>

      {isTotpEnrollmentPending ? (
        <p className="auth-step-note">
          Set up an authenticator app before entering a verification code.
        </p>
      ) : null}

      {isTotpEnrollmentReady ? (
        <div className="mfa-totp">
          <div className="mfa-totp__header">
            <strong>Connect your authenticator app</strong>
            <span>Scan this QR code, or use the setup code below.</span>
          </div>
          {totpQrDataUrl ? (
            <div className="mfa-totp__qr-frame">
              <img src={totpQrDataUrl} alt="Authenticator setup QR code" />
            </div>
          ) : null}
          <a className="mfa-totp__link" href={totpOtpauth}>
            <ExternalLink size={16} />
            Open authenticator app
          </a>
          <div className="mfa-totp__manual">
            <span>Manual setup code</span>
            <div className="mfa-totp__code-row">
              <code>{totpSetupCode}</code>
              <button
                type="button"
                className="mfa-totp__copy"
                onClick={copyTotpSetupCode}
                aria-label="Copy authenticator setup code"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCodeInput ? <CodeInput value={code} onChange={setCode} /> : null}

      <SubmitButton loading={submitting}>{submitLabel(controller)}</SubmitButton>
    </form>
  );
}
