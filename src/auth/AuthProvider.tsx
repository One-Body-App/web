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
import {
  clearActiveSocialAuth,
  clearSocialAuthMarkers,
  isActiveSocialAuthSession,
  promotePendingSocialAuth,
} from './socialAuthSession';
import { ChatAccountBoundary } from '@/chat/ChatVaultGate';
import { lockChatVault } from '@/chat/keyStore';
import { setTokenGetter } from '@/api/token';

const DEMO_KEY = 'ob_demo_session';
const CLERK_LOAD_TIMEOUT_MS = 8000;
const clerkTaskUrls = {
  'choose-organization': '/home',
  'reset-password': '/sign-in',
  'setup-mfa': '/secure-account',
};

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
  const { getToken, sessionId } = useClerkAuth();
  const timeoutStoreRef = useRef<ReturnType<typeof createLoadTimeoutStore>>();
  if (!timeoutStoreRef.current) timeoutStoreRef.current = createLoadTimeoutStore();

  const clerkReady = isLoaded && (!isSignedIn || Boolean(user));
  const activeSessionId = typeof sessionId === 'string' ? sessionId : null;
  const isSocialAuthSession =
    Boolean(activeSessionId) &&
    (promotePendingSocialAuth(activeSessionId) || isActiveSocialAuthSession(activeSessionId));
  if (isLoaded && !isSignedIn) {
    clearActiveSocialAuth();
  }

  // Expose Clerk's session token to the (non-React) API client.
  setTokenGetter(() => getToken(), activeSessionId);
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
      sessionId: loadTimedOut ? null : activeSessionId,
      isSocialAuthSession: loadTimedOut ? false : isSocialAuthSession,
      clerkEnabled: true,
      authError: loadTimedOut ? AUTH_UNAVAILABLE_MESSAGE : null,
      signOut: () => {
        lockChatVault();
        clearSocialAuthMarkers();
        return signOut();
      },
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
    [activeSessionId, clerkReady, isSignedIn, isSocialAuthSession, loadTimedOut, user, signOut]
  );

  return <AuthContext.Provider value={value}><ChatAccountBoundary key={value.sessionId ?? 'signed-out'} identity={value.isSignedIn ? value.user?.id ?? null : null}>{children}</ChatAccountBoundary></AuthContext.Provider>;
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
      sessionId: signedIn ? 'demo-session' : null,
      isSocialAuthSession: false,
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

  return <AuthContext.Provider value={value}><ChatAccountBoundary key={value.sessionId ?? 'signed-out'} identity={value.isSignedIn ? value.user?.id ?? null : null}>{children}</ChatAccountBoundary></AuthContext.Provider>;
}

function SignedOutAuthBridge({ children }: { children: ReactNode }) {
  const value = useMemo<AuthValue>(
    () => ({
      isLoaded: true,
      isSignedIn: false,
      sessionId: null,
      isSocialAuthSession: false,
      clerkEnabled: false,
      authError: AUTH_UNAVAILABLE_MESSAGE,
      user: null,
      signOut: () => undefined,
    }),
    []
  );

  return <AuthContext.Provider value={value}><ChatAccountBoundary key={value.sessionId ?? 'signed-out'} identity={value.isSignedIn ? value.user?.id ?? null : null}>{children}</ChatAccountBoundary></AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (clerkEnabled) {
    return (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        taskUrls={clerkTaskUrls}
      >
        <ClerkAuthBridge>{children}</ClerkAuthBridge>
      </ClerkProvider>
    );
  }
  if (clerkConfigError) return <SignedOutAuthBridge>{children}</SignedOutAuthBridge>;
  return <DemoAuthBridge>{children}</DemoAuthBridge>;
}
