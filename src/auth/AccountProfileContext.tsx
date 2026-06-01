import { createContext, useContext, type ReactNode } from 'react';
import type { ApiError } from '@/api/client';
import type { MyProfile } from '@/api/endpoints';
import { useAccountProfile } from './useAccountProfile';

interface AccountProfileValue {
  profile: MyProfile | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

const AccountProfileContext = createContext<AccountProfileValue | null>(null);

/**
 * Fetches the account profile once and shares it across the gate guard
 * (RequireAccountReady), the reverse guards (RequireGateStep), and the gate
 * route screens (/secure-account, /onboarding). This avoids the duplicate
 * profile fetch + Clerk sync that independent useAccountProfile() calls cause.
 *
 * Mounted high in the tree; the underlying query is disabled until the user is
 * signed in with Clerk enabled, so it is inert on public routes.
 */
export function AccountProfileProvider({ children }: { children: ReactNode }) {
  const value = useAccountProfile();
  return <AccountProfileContext.Provider value={value}>{children}</AccountProfileContext.Provider>;
}

export function useAccountProfileContext(): AccountProfileValue {
  const ctx = useContext(AccountProfileContext);
  if (!ctx) {
    throw new Error('useAccountProfileContext must be used within <AccountProfileProvider>');
  }
  return ctx;
}
