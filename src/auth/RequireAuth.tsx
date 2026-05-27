import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context';
import { Splash } from '@/components/Splash';

/** Gate for authenticated routes — redirects to the welcome screen when signed out. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return <Splash label="One Body" />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
