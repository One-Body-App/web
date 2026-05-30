import { apiFetch } from '@/api/client';

export const TURNSTILE_SITE_KEY = (
  import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY ?? ''
).trim();

export const TURNSTILE_SITE_KEY_CONFIGURED = Boolean(TURNSTILE_SITE_KEY);

/**
 * POST the token to the NestJS verify endpoint and resolve to true if the
 * secret-side check passes.
 */
export async function verifyTurnstileTokenWithApi(
  token: string,
  options?: { route?: string; signal?: AbortSignal; action?: string }
): Promise<boolean> {
  try {
    const response = await apiFetch<{ success?: boolean }>(
      options?.route ?? 'auth/verify-turnstile',
      {
        method: 'POST',
        body: {
          token,
          ...(options?.action ? { action: options.action } : {}),
        },
        auth: false,
        signal: options?.signal,
      }
    );
    return Boolean(response?.success);
  } catch {
    return false;
  }
}
