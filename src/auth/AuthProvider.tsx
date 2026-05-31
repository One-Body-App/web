import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useClerk, useUser } from '@clerk/clerk-react';
import {
  AuthContext,
  CLERK_PUBLISHABLE_KEY,
  clerkConfigError,
  clerkEnabled,
  DEMO_USER,
  type AuthValue,
} from './context';
import { setTokenGetter } from '@/api/token';
import { endpoints } from '@/api/endpoints';

const DEMO_KEY = 'ob_demo_session';

/**
 * Maps Clerk's user/session hooks onto our app-wide AuthContext so the rest
 * of the app never imports Clerk directly. Only mounted when Clerk is active.
 */
function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useClerkAuth();
  const syncedRef = useRef(false);

  // Expose Clerk's session token to the (non-React) API client.
  useEffect(() => {
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);

  // Ensure a Mongo user exists/linked for this Clerk session (once per sign-in).
  useEffect(() => {
    if (isSignedIn && user && !syncedRef.current) {
      syncedRef.current = true;
      endpoints
        .syncClerkUser({
          name: user.fullName ?? undefined,
          username: user.username ?? undefined,
          accountType: (user.unsafeMetadata?.accountType as string) || undefined,
        })
        .catch(() => {
          // Best-effort: ignore (e.g. CORS in local dev); retried next sign-in.
        });
    }
    if (!isSignedIn) syncedRef.current = false;
  }, [isSignedIn, user]);

  const value = useMemo<AuthValue>(
    () => ({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      clerkEnabled: true,
      signOut: () => signOut(),
      user: user
        ? {
            id: user.id,
            fullName: user.fullName ?? user.username ?? 'Friend',
            firstName: user.firstName ?? user.username ?? 'Friend',
            username: user.username ?? user.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'me',
            imageUrl: user.imageUrl,
            email: user.primaryEmailAddress?.emailAddress,
          }
        : null,
    }),
    [isLoaded, isSignedIn, user, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Local preview session used when no Clerk key is configured. Lets the full UI
 * be browsed (and screenshotted) before the publishable key is dropped in.
 */
function DemoAuthBridge({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(() => localStorage.getItem(DEMO_KEY) === '1');

  const value = useMemo<AuthValue>(
    () => ({
      isLoaded: true,
      isSignedIn: signedIn,
      clerkEnabled: false,
      user: signedIn ? DEMO_USER : null,
      demoSignIn: () => {
        localStorage.setItem(DEMO_KEY, '1');
        setSignedIn(true);
      },
      signOut: () => {
        localStorage.removeItem(DEMO_KEY);
        setSignedIn(false);
      },
    }),
    [signedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function SignedOutAuthBridge({ children }: { children: ReactNode }) {
  const value = useMemo<AuthValue>(
    () => ({
      isLoaded: true,
      isSignedIn: false,
      clerkEnabled: false,
      user: null,
      signOut: () => undefined,
    }),
    []
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (clerkEnabled) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        <ClerkAuthBridge>{children}</ClerkAuthBridge>
      </ClerkProvider>
    );
  }
  if (clerkConfigError) return <SignedOutAuthBridge>{children}</SignedOutAuthBridge>;
  return <DemoAuthBridge>{children}</DemoAuthBridge>;
}
