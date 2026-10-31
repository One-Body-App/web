/**
 * Bridges Clerk's React-only `getToken()` to the plain-function API client.
 * AuthProvider registers the getter once Clerk is ready; the client reads it
 * on every request to attach `Authorization: Bearer <clerk session token>`.
 */
type TokenGetter = () => Promise<string | null>;

let identity: string | null = null;
let generation = 0;
let tokenGetter: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter | null, owner: string | null = null) {
  if (identity !== owner) { generation++; identity = owner; }
  tokenGetter = getter;
}

export async function getAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  const expected = generation;
  try {
    const token = await tokenGetter();
    return expected === generation ? token : null;
  } catch {
    return null;
  }
}
