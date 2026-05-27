import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './client';
import { markApiOffline, markApiOnline } from './status';

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: ApiError | null;
  /** True when the live request failed and `fallback` data is being shown. */
  usingFallback: boolean;
  refetch: () => void;
}

interface QueryOptions<T> {
  /** Mock data shown if the live request fails (CORS/network/auth). */
  fallback?: T;
  enabled?: boolean;
  deps?: unknown[];
}

/** Fetch-on-mount query with graceful fallback to mock data. */
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions<T> = {},
): QueryState<T> {
  const { fallback, enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiError | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setUsingFallback(false);
        markApiOnline();
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const apiErr = err instanceof ApiError ? err : new ApiError('Unknown error', 0, err);
        setError(apiErr);
        if (apiErr.status === 0) markApiOffline();
        if (fallback !== undefined) {
          setData(fallback);
          setUsingFallback(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, usingFallback, refetch };
}

/** Imperative mutation helper for writes (react, post, follow, …). */
export function useApiMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (args: TArgs): Promise<TResult | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(args);
        markApiOnline();
        return result;
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : new ApiError('Unknown error', 0, err);
        setError(apiErr);
        if (apiErr.status === 0) markApiOffline();
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  return { mutate, loading, error };
}
