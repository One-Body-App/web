import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignUp } from '@clerk/clerk-react';
import { Check } from 'lucide-react';
import {
  AccountTypePicker,
  AuthDivider,
  AuthError,
  AuthSuccess,
  BackButton,
  CodeInput,
  PasswordField,
  SocialButtons,
  SubmitButton,
  TextField,
  type AccountType,
} from '@/components/auth/AuthControls';
import { AFTER_AUTH_URL, SSO_CALLBACK_URL, clerkErrorMessage } from '@/auth/clerkErrors';
import { ApiError } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { TurnstileGate } from '@/components/TurnstileGate';
import { useTurnstileVerification } from '@/auth/useTurnstileVerification';

type Step = 'type' | 'details' | 'verify';

const normalizeUsername = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]/g, '');

function suggestUsernames(base: string, name: string): string[] {
  const rand = () => Math.floor(Math.random() * 900 + 100);
  const fromName = normalizeUsername(name).slice(0, 14);
  const candidates = [
    `${base}${rand()}`,
    `${base}_${rand()}`,
    `${base}.${String(rand()).slice(0, 2)}`,
    fromName ? `${fromName}${String(rand()).slice(0, 2)}` : `${base}${rand()}`,
  ];
  return [...new Set(candidates)].filter((c) => c.length >= 3).slice(0, 4);
}

export function ClerkSignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('type');
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameOk, setUsernameOk] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstile = useTurnstileVerification(setError);

  const isOrg = accountType === 'organization';
  const confirmError =
    confirmPassword && confirmPassword !== password ? 'Passwords must match.' : '';

  async function checkUsername(raw: string) {
    const normalized = normalizeUsername(raw);
    setUsernameOk(false);
    setSuggestions([]);
    if (!normalized) return;
    if (normalized.length < 3) {
      setUsernameError('Usernames must be at least 3 characters.');
      return;
    }
    setCheckingUsername(true);
    setUsernameError('');
    try {
      await endpoints.checkUsername(normalized);
      setUsernameOk(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setUsernameError('This username is already in use. If it belongs to you, please sign in.');
        setSuggestions(suggestUsernames(normalized, name));
      }
      // Network/CORS errors: skip the pre-check; Clerk validates uniqueness on submit.
    } finally {
      setCheckingUsername(false);
    }
  }

  async function social(strategy: 'oauth_google' | 'oauth_apple') {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: SSO_CALLBACK_URL,
        redirectUrlComplete: AFTER_AUTH_URL,
        unsafeMetadata: accountType ? { accountType } : undefined,
      });
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  }

  async function submitDetails(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    if (username.length < 3) {
      setUsernameError('Usernames must be at least 3 characters.');
      return;
    }
    if (usernameError) return;
    if (confirmError) return;

    setBusy(true);
    setError(null);
    const [firstName, ...rest] = name.trim().split(/\s+/);
    try {
      const turnstileOk = await turnstile.verify('auth-sign-up');
      if (!turnstileOk) return;

      await signUp.create({
        emailAddress: email,
        password,
        username,
        firstName: firstName || name.trim(),
        lastName: rest.join(' ') || undefined,
        unsafeMetadata: accountType ? { accountType } : undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitVerify(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        navigate(AFTER_AUTH_URL, { replace: true });
      } else {
        setError('That code didn’t work. Please try again.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err, 'That code didn’t work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!isLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  }

  /* ----- Step 1: account type ----- */
  if (step === 'type') {
    return (
      <div className="auth-form">
        <p className="auth-step-note">First, tell us who’s joining the family.</p>
        <AccountTypePicker value={accountType} onChange={setAccountType} />
        <SubmitButton
          type="button"
          disabled={!accountType}
          onClick={() => accountType && setStep('details')}
        >
          Continue
        </SubmitButton>
      </div>
    );
  }

  /* ----- Step 3: verify email ----- */
  if (step === 'verify') {
    return (
      <form className="auth-form" onSubmit={submitVerify}>
        <BackButton onClick={() => { setStep('details'); setError(null); }} />
        <AuthSuccess>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it to verify your account.
        </AuthSuccess>
        <AuthError message={error} />
        <CodeInput value={code} onChange={setCode} />
        <SubmitButton loading={busy} disabled={code.length < 6}>
          Verify &amp; continue
        </SubmitButton>
        <div className="auth-row">
          <button type="button" className="auth-link" onClick={resend}>
            Resend code
          </button>
        </div>
      </form>
    );
  }

  /* ----- Step 2: details ----- */
  const canSubmit =
    username.length >= 3 &&
    !usernameError &&
    Boolean(name && email && password) &&
    !confirmError &&
    turnstile.passed;

  return (
    <div className="auth-form">
      <BackButton onClick={() => { setStep('type'); setError(null); }} label="Change account type" />
      <SocialButtons
        onGoogle={() => social('oauth_google')}
        onApple={() => social('oauth_apple')}
        disabled={busy}
        verb="Sign up"
      />
      <AuthDivider />
      <form className="auth-form" onSubmit={submitDetails}>
        <AuthError message={error} />

        <TextField
          label="Create a Username"
          autoComplete="username"
          placeholder="e.g. brother_john"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          error={usernameError}
          onChange={(e) => {
            setUsername(normalizeUsername(e.target.value));
            setUsernameError('');
            setUsernameOk(false);
            setSuggestions([]);
          }}
          onBlur={() => checkUsername(username)}
          rightSlot={
            checkingUsername ? (
              <span className="field__spinner" />
            ) : usernameOk ? (
              <span className="field__ok">
                <Check size={18} />
              </span>
            ) : null
          }
        />

        {suggestions.length > 0 ? (
          <div className="username-suggestions">
            <p className="username-suggestions__label">Suggested usernames:</p>
            <div className="username-suggestions__chips">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => {
                    setUsername(s);
                    setSuggestions([]);
                    checkUsername(s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <TextField
          label={isOrg ? 'Organization / Ministry Name' : 'Display Name'}
          autoComplete="name"
          placeholder="How should we address you?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          required
        />
        <PasswordField
          label="Create a Password"
          autoComplete="new-password"
          placeholder="Enter a secure password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordField
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="Re-enter password for security"
          value={confirmPassword}
          error={confirmError}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {turnstile.enabled ? (
          <div className="auth-turnstile">
            <TurnstileGate
              key={turnstile.resetKey}
              action="auth-sign-up"
              size="flexible"
              onVerify={turnstile.handleVerify}
              onExpire={turnstile.clear}
              onError={turnstile.clear}
            />
          </div>
        ) : null}
        <SubmitButton loading={busy} disabled={!canSubmit}>
          Create account
        </SubmitButton>
      </form>
    </div>
  );
}
