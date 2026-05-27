import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { Splash } from '@/components/Splash';
import { AFTER_AUTH_URL } from '@/auth/clerkErrors';

/** Lands the OAuth (Google/Apple) redirect and completes the Clerk session. */
export function SsoCallback() {
  return (
    <>
      <Splash label="Signing you in…" />
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl={AFTER_AUTH_URL}
        signUpForceRedirectUrl={AFTER_AUTH_URL}
      />
    </>
  );
}
