import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { clearPendingSocialAuth, markPendingSocialAuth } from '@/auth/socialAuthSession';

type Mode = 'signin' | 'mfa-email' | 'reset-request' | 'reset-code';

type ClerkEmailSecondFactor = {
  strategy?: string;
  emailAddressId?: string;
  email_address_id?: string;
  safeIdentifier?: string;
  safe_identifier?: string;
};

type ClerkResetEmailFactor = {
  strategy?: string;
  emailAddressId?: string;
  email_address_id?: string;
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

function getResetEmailFactor(signInAttempt: unknown) {
  const factors =
    signInAttempt && typeof signInAttempt === 'object'
      ? ((
          signInAttempt as {
            supportedFirstFactors?: ClerkResetEmailFactor[] | null;
            supported_first_factors?: ClerkResetEmailFactor[] | null;
          }
        ).supportedFirstFactors ??
        (
          signInAttempt as {
            supported_first_factors?: ClerkResetEmailFactor[] | null;
          }
        ).supported_first_factors)
      : null;

  if (!Array.isArray(factors)) {
    return null;
  }

  const factor = factors.find((item) => item?.strategy === 'reset_password_email_code');
  if (!factor) {
    return null;
  }

  return {
    emailAddressId: factor.emailAddressId ?? factor.email_address_id,
  };
}

export function ClerkSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startsInResetMode = searchParams.get('reset') === '1';

  const [mode, setMode] = useState<Mode>(() => (startsInResetMode ? 'reset-request' : 'signin'));
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mfaEmailRef = useRef('');
  const turnstile = useTurnstileVerification(setError);

  async function social(strategy: 'oauth_google' | 'oauth_apple') {
    if (!isLoaded) return;
    setError(null);
    try {
      markPendingSocialAuth(strategy);
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: SSO_CALLBACK_URL,
        redirectUrlComplete: AFTER_AUTH_URL,
      });
    } catch (err) {
      clearPendingSocialAuth();
      setError(clerkErrorMessage(err));
    }
  }

  async function submitSignIn(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      clearPendingSocialAuth();
      const turnstileOk = await turnstile.verify('auth-sign-in');
      if (!turnstileOk) return;

      const res = await signIn.create({ identifier: email, password });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
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
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await signIn.create({
        identifier: normalizedEmail,
        strategy: 'reset_password_email_code',
      });
      const emailFactor = getResetEmailFactor(res);
      if (res.status === 'needs_first_factor' && emailFactor?.emailAddressId) {
        await signIn.prepareFirstFactor({
          strategy: 'reset_password_email_code',
          emailAddressId: emailFactor.emailAddressId,
        });
      }
      setEmail(normalizedEmail);
      setCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      setMode('reset-code');
    } catch (err) {
      setError(clerkErrorMessage(err, 'Unable to send reset instructions.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || busy) return;
    if (resetPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: resetPassword,
      });

      if (res.status === 'needs_new_password') {
        res = await signIn.resetPassword({
          password: resetPassword,
          signOutOfOtherSessions: true,
        });
      }

      if (res.status !== 'complete') {
        setError('Additional verification is required to reset your password.');
        return;
      }

      if (res.createdSessionId) {
        await setActive({ session: res.createdSessionId });
      }
      navigate(AFTER_AUTH_URL, { replace: true });
    } catch (err) {
      setError(clerkErrorMessage(err, 'Unable to reset your password.'));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'reset-request' || mode === 'reset-code') {
    return (
      <form className="auth-form" onSubmit={mode === 'reset-code' ? confirmReset : requestReset}>
        <BackButton
          onClick={() => {
            setMode('signin');
            setError(null);
            setCode('');
            setResetPassword('');
            setResetConfirmPassword('');
          }}
          label="Back to sign in"
        />
        <p className="auth-step-note">
          {mode === 'reset-code'
            ? 'Enter the code we sent and choose a new password.'
            : 'Enter your email and we’ll send you a password reset code.'}
        </p>
        {mode === 'reset-code' ? (
          <AuthSuccess>
            If an account exists for <strong>{email}</strong>, we sent a password reset code.
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
            if (mode === 'reset-code') {
              setMode('reset-request');
            }
          }}
          required
        />
        {mode === 'reset-code' ? (
          <>
            <CodeInput value={code} onChange={setCode} />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              placeholder="Create a new password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              required
            />
            <PasswordField
              label="Confirm password"
              autoComplete="new-password"
              placeholder="Confirm your new password"
              value={resetConfirmPassword}
              onChange={(e) => setResetConfirmPassword(e.target.value)}
              required
            />
          </>
        ) : null}
        <SubmitButton
          loading={busy}
          disabled={
            !email ||
            (mode === 'reset-code' &&
              (code.length < 6 || !resetPassword || !resetConfirmPassword))
          }
        >
          {mode === 'reset-code' ? 'Reset password' : 'Send reset code'}
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
