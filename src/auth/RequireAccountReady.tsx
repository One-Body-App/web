import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/api/client';
import { Splash } from '@/components/Splash';
import { AuthError } from '@/components/auth/AuthControls';
import '@/components/auth/auth-form.css';
import './AccountGate.css';
import { useAuth } from './context';
import { useAccountProfileContext } from './AccountProfileContext';

function AccountGateFrame({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="account-gate">
      <main className="account-gate__panel" aria-live="polite">
        <div className="account-gate__mark">
          <ShieldCheck size={26} />
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </main>
    </div>
  );
}

function AccountGateError({
  error,
  onRetry,
  onSignOut,
}: {
  error: ApiError | null;
  onRetry: () => void;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <AccountGateFrame
      title="Account check failed"
      subtitle="We could not verify your account status. Try again before entering One Body."
    >
      <AuthError message={error?.message ?? 'Unable to load your account.'} />
      <div className="account-gate__actions">
        <button type="button" className="btn btn--brand" onClick={onRetry}>
          <RefreshCw size={18} /> Retry
        </button>
        <button type="button" className="btn btn--outline" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </AccountGateFrame>
  );
}

function EmailVerificationGate({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <AccountGateFrame
      title="Verify your email"
      subtitle="Open your verification email, then retry before entering One Body."
    >
      <div className="account-gate__actions">
        <button type="button" className="btn btn--brand" onClick={onRetry}>
          <Mail size={18} /> I verified my email
        </button>
        <button type="button" className="btn btn--outline" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </AccountGateFrame>
  );
}

/**
 * Single forward guard for the authenticated app shell. Profile flags are the
 * source of truth for the required post-email order:
 *
 *   email verified -> passkey-first MFA -> onboarding -> app
 *
 * The MFA and onboarding steps now live on dedicated full-screen routes
 * (/secure-account, /onboarding/:step), so this guard redirects to them rather
 * than rendering gates inline. The reverse RequireGateStep guard keeps those
 * routes from being skipped or revisited out of order.
 */
export function RequireAccountReady({ children }: { children: ReactNode }) {
  const { clerkEnabled, isLoaded, isSignedIn, signOut } = useAuth();
  const location = useLocation();
  const { error, loading, profile, refetch } = useAccountProfileContext();

  if (!isLoaded) {
    return <Splash label="One Body" />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // Demo mode (no Clerk key): there is no real account to gate on, so the full
  // UI is previewable. Gates only run with Clerk configured (i.e. production).
  if (!clerkEnabled) {
    if (import.meta.env.DEV) {
      console.warn('[RequireAccountReady] gates bypassed: no Clerk key (demo mode).');
    }
    return <>{children}</>;
  }

  if (loading) {
    return <Splash label="Loading your account" />;
  }

  if (error) {
    return <AccountGateError error={error} onRetry={refetch} onSignOut={signOut} />;
  }

  if (!profile) {
    return <Splash label="Loading your account" />;
  }

  if (profile.emailVerified !== true) {
    return <EmailVerificationGate onRetry={refetch} onSignOut={signOut} />;
  }

  if (profile.mfaConfig?.isMfaActive !== true) {
    return <Navigate to="/secure-account" replace />;
  }

  if (profile.isProfileCompleted !== true) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
