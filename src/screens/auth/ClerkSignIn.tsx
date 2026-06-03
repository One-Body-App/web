import { useRef, useState, type FormEvent } from 'react';
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
import { endpoints } from '@/api/endpoints';

type Mode = 'signin' | 'mfa-email' | 'reset-request' | 'reset-link-sent';

type ClerkEmailSecondFactor = {
  strategy?: string;
  emailAddressId?: string;
  email_address_id?: string;
  safeIdentifier?: string;
  safe_identifier?: string;
};

function getEmailSecondFactor(signInAttempt: unknown) {
  const factors =
    signInAttempt && typeof signInAttempt === 'object'
      ? ((
          signInAttempt as {
            supportedSecondFactors?: ClerkEmailSecondFactor[] | null;
            supported_second_factors?: ClerkEmailSecondFactor[] | null;
          }
        ).supportedSecondFactors ??
        (
          signInAttempt as {
            supported_second_factors?: ClerkEmailSecondFactor[] | null;
          }
        ).supported_second_factors)
      : null;

  if (!Array.isArray(factors)) {
    return null;
  }

  const factor = factors.find((item) => item?.strategy === 'email_code');
  if (!factor) {
    return null;
  }

  return {
    emailAddressId: factor.emailAddressId ?? factor.email_address_id,
    safeIdentifier: factor.safeIdentifier ?? factor.safe_identifier,
  };
}

export function ClerkSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mfaEmailRef = useRef('');
  const turnstile = useTurnstileVerification(setError);

  async function routeToAppMfaIfRequired() {
    const response = await endpoints.beginMfaLogin();
    if (response.mfaRequired === true) {
      navigate('/secure-account?mode=login', { replace: true });
      return true;
    }

    return false;
  }

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
        if (await routeToAppMfaIfRequired()) return;
        navigate(AFTER_AUTH_URL, { replace: true });
      } else if (res.status === 'needs_second_factor') {
        const emailFactor = getEmailSecondFactor(res);
        if (!emailFactor) {
          setError('Your account requires a second factor that is not available here.');
          return;
        }

        await signIn.prepareSecondFactor({
          strategy: 'email_code',
          emailAddressId: emailFactor.emailAddressId,
        });
        setCode('');
        mfaEmailRef.current = emailFactor.safeIdentifier ?? email;
        setMode('mfa-email');
      } else {
        setError('Additional verification is required to finish signing in.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err, 'Incorrect email or password.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmMfa(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code,
      });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        if (await routeToAppMfaIfRequired()) return;
        navigate(AFTER_AUTH_URL, { replace: true });
      } else {
        setError('Additional verification is required to finish signing in.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err, 'That code did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await endpoints.forgotPassword({
        email: email.trim().toLowerCase(),
      });
      setMode('reset-link-sent');
    } catch (err) {
      setError(clerkErrorMessage(err, 'Unable to send reset instructions.'));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'reset-request' || mode === 'reset-link-sent') {
    return (
      <form className="auth-form" onSubmit={requestReset}>
        <BackButton
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
          label="Back to sign in"
        />
        <p className="auth-step-note">
          Enter your email and we’ll send you a link to reset your password.
        </p>
        {mode === 'reset-link-sent' ? (
          <AuthSuccess>
            If an account exists for <strong>{email}</strong>, we sent a password reset link.
          </AuthSuccess>
        ) : null}
        <AuthError message={error} />
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (mode === 'reset-link-sent') {
              setMode('reset-request');
            }
          }}
          required
        />
        <SubmitButton loading={busy} disabled={!email}>
          Send reset link
        </SubmitButton>
      </form>
    );
  }

  if (mode === 'mfa-email') {
    return (
      <form className="auth-form" onSubmit={confirmMfa}>
        <BackButton
          onClick={() => {
            setMode('signin');
            setCode('');
            mfaEmailRef.current = '';
            setError(null);
          }}
          label="Back to sign in"
        />
        <AuthSuccess>
          We sent a verification code to <strong>{mfaEmailRef.current || email}</strong>.
        </AuthSuccess>
        <AuthError message={error} />
        <CodeInput value={code} onChange={setCode} />
        <SubmitButton loading={busy} disabled={code.length < 6}>
          Verify & sign in
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
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setMode('reset-request');
              setError(null);
            }}
          >
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
