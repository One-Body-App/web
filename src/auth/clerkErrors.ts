/** Extracts a human-friendly message from a Clerk API error. */
export function clerkErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err && typeof err === 'object' && 'errors' in err) {
    const errors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    if (errors && errors.length) {
      return errors[0].longMessage ?? errors[0].message ?? fallback;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const SSO_CALLBACK_URL = '/sso-callback';
export const AFTER_AUTH_URL = '/home';
