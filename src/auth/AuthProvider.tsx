import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useClerk, useUser } from '@clerk/clerk-react';
import {
  AuthContext,
  AUTH_UNAVAILABLE_MESSAGE,
  CLERK_PUBLISHABLE_KEY,
  clerkConfigError,
  clerkEnabled,
  DEMO_USER,
  type AuthValue,
} from './context';
import { setTokenGetter } from '@/api/token';

const DEMO_KEY = 'ob_demo_session';
const CLERK_LOAD_TIMEOUT_MS = 8000;

function metadataString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function createLoadTimeoutStore() {
  let loaded = true;
  let timedOut = false;
  let timeout: number | undefined;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const clear = () => {
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      timeout = undefined;
    }
  };
  const schedule = () => {
    if (loaded || timeout !== undefined || typeof window === 'undefined') return;
    timeout = window.setTimeout(() => {
      timeout = undefined;
      if (!loaded) {
        timedOut = true;
        emit();
      }
    }, CLERK_LOAD_TIMEOUT_MS);
  };

  return {
    getSnapshot: () => !loaded && timedOut,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      schedule();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) clear();
      };
    },
    setLoaded: (nextLoaded: boolean) => {
      if (loaded === nextLoaded) return;
      loaded = nextLoaded;
      if (loaded) {
        clear();
        timedOut = false;
      } else {
        timedOut = false;
        schedule();
      }
    },
  };
}

/**
 * Maps Clerk's user/session hooks onto our app-wide AuthContext so the rest
 * of the app never imports Clerk directly. Only mounted when Clerk is active.
 */
function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useClerkAuth();
  const timeoutStoreRef = useRef<ReturnType<typeof createLoadTimeoutStore>>();
  if (!timeoutStoreRef.current) timeoutStoreRef.current = createLoadTimeoutStore();

  const clerkReady = isLoaded && (!isSignedIn || Boolean(user));

  // Expose Clerk's session token to the (non-React) API client.
  setTokenGetter(() => getToken());
  timeoutStoreRef.current.setLoaded(clerkReady);
  const loadTimedOut = useSyncExternalStore(
    timeoutStoreRef.current.subscribe,
    timeoutStoreRef.current.getSnapshot,
    timeoutStoreRef.current.getSnapshot,
  );

  const value = useMemo<AuthValue>(
    () => ({
      isLoaded: clerkReady || loadTimedOut,
      isSignedIn: loadTimedOut ? false : Boolean(isSignedIn && user),
      clerkEnabled: true,
      authError: loadTimedOut ? AUTH_UNAVAILABLE_MESSAGE : null,
      signOut: () => signOut(),
      user: user && !loadTimedOut
        ? {
            id: user.id,
            fullName:
              user.fullName ?? metadataString(user.unsafeMetadata?.username) ?? user.username ?? 'Friend',
            firstName:
              user.firstName ?? metadataString(user.unsafeMetadata?.username) ?? user.username ?? 'Friend',
            username:
              metadataString(user.unsafeMetadata?.username) ??
              user.username ??
              user.primaryEmailAddress?.emailAddress?.split('@')[0] ??
              'me',
            imageUrl: user.imageUrl,
            email: user.primaryEmailAddress?.emailAddress,
            accountType:
              user.unsafeMetadata?.accountType === 'organization' ? 'organization' : 'individual',
          }
        : null,
    }),
    [clerkReady, isSignedIn, loadTimedOut, user, signOut]
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
      authError: null,
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
      authError: AUTH_UNAVAILABLE_MESSAGE,
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
