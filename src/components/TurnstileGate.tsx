import { useCallback, useId, useRef, useState } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { TURNSTILE_SITE_KEY } from './turnstile';
import './TurnstileGate.css';

/**
 * Standalone Cloudflare Turnstile widget.
 *
 * Designed for One Body-managed Turnstile surfaces.
 *
 * Site key comes from VITE_CLOUDFLARE_TURNSTILE_SITE_KEY. The matching
 * secret stays on the NestJS API and is never read here.
 */

type TurnstileOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  theme?: 'auto' | 'light' | 'dark';
  size?: 'normal' | 'flexible' | 'compact' | 'invisible';
  action?: string;
  cData?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
};

type TurnstileApi = {
  render: (element: HTMLElement | string, options: TurnstileOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Module-level singleton: we load the Turnstile script once across the whole
// app no matter how many <TurnstileGate>s mount.
let loaderPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile requires a browser environment.'));
  }
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.turnstile) resolve(window.turnstile);
        else reject(new Error('Turnstile script loaded but window.turnstile is missing.'));
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load Turnstile script.')));
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile script loaded but window.turnstile is missing.'));
    };
    script.onerror = () => reject(new Error('Failed to load Turnstile script.'));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export type TurnstileGateProps = {
  /** Called when the user passes the challenge. The token is single-use and
   *  expires after about 5 minutes - send it to your backend promptly. */
  onVerify: (token: string) => void;
  /** Called on render error (network failure, blocked site key, etc.). */
  onError?: (message: string) => void;
  /** Called when a previously-issued token expires. The widget auto-resets. */
  onExpire?: () => void;
  /** Override the site key from VITE_CLOUDFLARE_TURNSTILE_SITE_KEY. */
  siteKey?: string;
  /** Visual theme. Defaults to `auto` (follows prefers-color-scheme). */
  theme?: 'auto' | 'light' | 'dark';
  /** Widget footprint. `flexible` adapts width; `compact` shrinks. */
  size?: 'normal' | 'flexible' | 'compact';
  /** Action label sent to Cloudflare so analytics can split by surface. */
  action?: string;
  /** Extra className on the wrapper element. */
  className?: string;
};

type WidgetStatus = 'idle' | 'loading' | 'ready' | 'verified' | 'error' | 'expired';

export function TurnstileGate({
  onVerify,
  onError,
  onExpire,
  siteKey,
  theme = 'auto',
  size = 'flexible',
  action,
  className,
}: TurnstileGateProps) {
  const reactId = useId();
  const widgetIdRef = useRef<string | null>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<WidgetStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Latest callbacks via refs so the render effect can stay mount-only.
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onErrorRef.current = onError;
  onExpireRef.current = onExpire;

  const resolvedSiteKey = (siteKey ?? TURNSTILE_SITE_KEY).trim();

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!node || !resolvedSiteKey) return;
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        apiRef.current = api;
        try {
          const widgetId = api.render(node, {
            sitekey: resolvedSiteKey,
            theme,
            size,
            action,
            callback: (token) => {
              setStatus('verified');
              setErrorMessage(null);
              onVerifyRef.current(token);
            },
            'error-callback': () => {
              setStatus('error');
              const message = 'Turnstile failed to verify. Please try again.';
              setErrorMessage(message);
              onErrorRef.current?.(message);
            },
            'expired-callback': () => {
              setStatus('expired');
              onExpireRef.current?.();
              // Auto-reset so the user gets a fresh challenge without action.
              if (apiRef.current && widgetIdRef.current) {
                apiRef.current.reset(widgetIdRef.current);
                setStatus('ready');
              }
            },
            'timeout-callback': () => {
              setStatus('error');
              const message = 'Verification timed out. Please try again.';
              setErrorMessage(message);
              onErrorRef.current?.(message);
            },
          });
          widgetIdRef.current = widgetId;
          setStatus('ready');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Could not render Turnstile.';
          setStatus('error');
          setErrorMessage(message);
          onErrorRef.current?.(message);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err.message);
        onErrorRef.current?.(err.message);
      });

    cleanupRef.current = () => {
      cancelled = true;
      if (apiRef.current && widgetIdRef.current) {
        try {
          apiRef.current.remove(widgetIdRef.current);
        } catch {
          // Cleanup is best-effort; the script may already have been torn down.
        }
        widgetIdRef.current = null;
      }
    };
  }, [resolvedSiteKey, theme, size, action]);

  if (!resolvedSiteKey) {
    return (
      <div
        className={`turnstile turnstile--preview${className ? ` ${className}` : ''}`}
        aria-live="polite"
      >
        <Shield size={16} aria-hidden="true" />
        <div>
          <strong>Turnstile preview mode.</strong>
          <p>
            Add <code>VITE_CLOUDFLARE_TURNSTILE_SITE_KEY</code> to <code>web/.env.local</code> to
            enable real challenges. Cloudflare's test key{' '}
            <code>1x00000000000000000000AA</code> always passes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`turnstile${className ? ` ${className}` : ''}`}>
      <div
        ref={containerRef}
        className="turnstile__widget"
        id={`turnstile-${reactId.replace(/[^a-zA-Z0-9-]/g, '-')}`}
        data-status={status}
      />
      {errorMessage ? (
        <p className="turnstile__error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
