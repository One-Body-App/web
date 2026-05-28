import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AccountTypePicker,
  AuthDivider,
  PasswordField,
  SocialButtons,
  SubmitButton,
  TextField,
  type AccountType,
} from '@/components/auth/AuthControls';
import { useAuth } from '@/auth/context';

/** Preview-mode auth (no Clerk key). Mirrors the real forms visually; any
 *  submission starts a local demo session so the app can be explored. */
export function DemoAuth({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { demoSignIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('grace@onebody.app');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [step, setStep] = useState<'type' | 'details'>(mode === 'sign-up' ? 'type' : 'details');

  function start(e?: FormEvent) {
    e?.preventDefault();
    demoSignIn?.();
    navigate('/home', { replace: true });
  }

  if (mode === 'sign-up' && step === 'type') {
    return (
      <div className="auth-form">
        <p className="auth-step-note">First, tell us who’s joining the family.</p>
        <AccountTypePicker value={accountType} onChange={setAccountType} />
        <SubmitButton type="button" disabled={!accountType} onClick={() => setStep('details')}>
          Continue
        </SubmitButton>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <SocialButtons
        onGoogle={() => start()}
        onApple={() => start()}
        verb={mode === 'sign-up' ? 'Sign up' : 'Continue'}
      />
      <AuthDivider />
      <form className="auth-form" onSubmit={start}>
        {mode === 'sign-up' ? (
          <TextField label="Full name" placeholder="Grace Whitfield" autoComplete="name" />
        ) : null}
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password"
          placeholder="••••••••"
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton>{mode === 'sign-up' ? 'Create account' : 'Sign in'}</SubmitButton>
      </form>
      <p className="auth-step-note" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
        Preview mode, any details continue to the app.
      </p>
    </div>
  );
}
