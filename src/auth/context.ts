import { createContext, useContext } from 'react';

export interface AppUser {
  id: string;
  fullName: string;
  firstName: string;
  username: string;
  imageUrl: string;
  email?: string;
  accountType?: 'individual' | 'organization';
}

export interface AuthValue {
  /** Clerk (or demo) has finished initializing. */
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AppUser | null;
  signOut: () => void | Promise<void>;
  /** True when a real Clerk publishable key is configured. */
  clerkEnabled: boolean;
  /** Demo-only: flips the local preview session to signed-in. */
  demoSignIn?: () => void;
}

/** True when VITE_CLERK_PUBLISHABLE_KEY is set to a browser-safe Clerk key. */
export const CLERK_PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim();
export const clerkConfigError =
  CLERK_PUBLISHABLE_KEY && !CLERK_PUBLISHABLE_KEY.startsWith('pk_')
    ? 'Authentication is temporarily unavailable. Please contact One Body support.'
    : null;
export const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY && !clerkConfigError);

/** Demo identity used when no Clerk key is configured, so the UI is previewable. */
export const DEMO_USER: AppUser = {
  id: 'demo-user',
  fullName: 'Grace Whitfield',
  firstName: 'Grace',
  username: 'gracew',
  imageUrl: '/brand/avatar2.png',
  email: 'grace@onebody.app',
  accountType: 'individual',
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
