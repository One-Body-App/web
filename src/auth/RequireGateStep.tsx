import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Splash } from '@/components/Splash';
import { useAuth } from './context';
import { useAccountProfileContext } from './AccountProfileContext';

/**
 * Reverse guard for the dedicated gate routes (/secure-account, /onboarding).
 * Keeps the post-email flow strictly ordered in both directions: a user can
 * neither linger on a gate they've already cleared nor deep-link past one they
 * haven't. Profile flags are the single source of truth, matching
 * RequireAccountReady's forward checks.
 */
export function RequireGateStep({ gate, children }: { gate: 'mfa' | 'onboarding'; children: ReactNode }) {
  const { isLoaded, isSignedIn, clerkEnabled } = useAuth();
  const { profile, loading } = useAccountProfileContext();

  if (!isLoaded) return <Splash label="One Body" />;
  if (!isSignedIn) return <Navigate to="/" replace />;

  // Demo mode (no Clerk key) has no profile to gate on — send to the app shell,
  // which handles the demo bypass itself. See RequireAccountReady.
  if (!clerkEnabled) return <Navigate to="/home" replace />;

  if (loading) return <Splash label="Loading your account" />;

  // On error / missing profile, defer to RequireAccountReady (it renders the
  // retryable error gate at /home rather than trapping the user on a gate route).
  if (!profile) return <Navigate to="/home" replace />;

  // Email must be verified before any gate route is usable.
  if (profile.emailVerified !== true) return <Navigate to="/home" replace />;

  const mfaActive = profile.mfaConfig?.isMfaActive === true;
  const profileComplete = profile.isProfileCompleted === true;

  if (gate === 'mfa') {
    // Already secured -> move forward to whatever is next.
    if (mfaActive) {
      return <Navigate to={profileComplete ? '/home' : '/onboarding'} replace />;
    }
    return <>{children}</>;
  }

  // gate === 'onboarding'
  if (!mfaActive) return <Navigate to="/secure-account" replace />;
  if (profileComplete) return <Navigate to="/home" replace />;
  return <>{children}</>;
}
