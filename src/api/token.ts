/**
 * Bridges Clerk's React-only `getToken()` to the plain-function API client.
 * AuthProvider registers the getter once Clerk is ready; the client reads it
 * on every request to attach `Authorization: Bearer <clerk session token>`.
 */
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter | null) {
  tokenGetter = getter;
}

export async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}
