import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignIn } from '@clerk/clerk-react';
import {
  AuthDivider,
  AuthError,
  AuthSuccess,
  BackButton,
  CodeInput,
  PasswordField,
  SocialButtons,
  SubmitButton,
  TextField,
} from '@/components/auth/AuthControls';
import { AFTER_AUTH_URL, SSO_CALLBACK_URL, clerkErrorMessage } from '@/auth/clerkErrors';
import { TurnstileGate } from '@/components/TurnstileGate';
import { useTurnstileVerification } from '@/auth/useTurnstileVerification';

type Mode = 'signin' | 'reset-request' | 'reset-verify';

export function ClerkSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstile = useTurnstileVerification(setError);

  async function social(strategy: 'oauth_google' | 'oauth_apple') {
    if (!isLoaded) return;
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: SSO_CALLBACK_URL,
        redirectUrlComplete: AFTER_AUTH_URL,
      });
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  }

  async function submitSignIn(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const turnstileOk = await turnstile.verify('auth-sign-in');
      if (!turnstileOk) return;

      const res = await signIn.create({ identifier: email, password });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        navigate(AFTER_AUTH_URL, { replace: true });
      } else {
        setError('Additional verification is required to finish signing in.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err, 'Incorrect email or password.'));
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setMode('reset-verify');
    } catch (err) {
      setError(clerkErrorMessage(err, 'We couldn’t find an account with that email.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });
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

  if (mode === 'reset-request') {
    return (
      <form className="auth-form" onSubmit={requestReset}>
        <BackButton onClick={() => { setMode('signin'); setError(null); }} label="Back to sign in" />
        <p className="auth-step-note">
          Enter your email and we’ll send you a code to reset your password.
        </p>
        <AuthError message={error} />
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <SubmitButton loading={busy} disabled={!email}>
          Send reset code
        </SubmitButton>
      </form>
    );
  }

  if (mode === 'reset-verify') {
    return (
      <form className="auth-form" onSubmit={confirmReset}>
        <BackButton onClick={() => { setMode('reset-request'); setError(null); }} />
        <AuthSuccess>
          We sent a code to <strong>{email}</strong>. Enter it below with your new password.
        </AuthSuccess>
        <AuthError message={error} />
        <CodeInput value={code} onChange={setCode} />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="Create a new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <SubmitButton loading={busy} disabled={code.length < 6 || !newPassword}>
          Reset & sign in
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="auth-form">
      <SocialButtons
        onGoogle={() => social('oauth_google')}
        onApple={() => social('oauth_apple')}
        disabled={busy}
      />
      <AuthDivider />
      <form className="auth-form" onSubmit={submitSignIn}>
        <AuthError message={error} />
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="auth-row" style={{ justifyContent: 'flex-end', marginTop: 0 }}>
          <button type="button" className="auth-link" onClick={() => { setMode('reset-request'); setError(null); }}>
            Forgot password?
          </button>
        </div>
        {turnstile.enabled ? (
          <div className="auth-turnstile">
            <TurnstileGate
              key={turnstile.resetKey}
              action="auth-sign-in"
              size="flexible"
              onVerify={turnstile.handleVerify}
              onExpire={turnstile.clear}
              onError={turnstile.clear}
            />
          </div>
        ) : null}
        <SubmitButton loading={busy} disabled={!email || !password || !turnstile.passed}>
          Sign in
        </SubmitButton>
      </form>
    </div>
  );
}
