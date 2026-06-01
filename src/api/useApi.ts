import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
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

type QuerySnapshot<T> = Omit<QueryState<T>, 'refetch'>;

const queryKeyPart = (value: unknown): string => {
  if (value == null) return String(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

function createQueryStore<T>() {
  let snapshot: QuerySnapshot<T> = {
    data: undefined,
    loading: false,
    error: null,
    usingFallback: false,
  };
  let key = '';
  let requestId = 0;
  let controller: AbortController | null = null;
  let abortHandle: number | undefined;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const update = (patch: Partial<QuerySnapshot<T>>) => {
    snapshot = { ...snapshot, ...patch };
    emit();
  };
  const clearDeferredAbort = () => {
    if (abortHandle !== undefined) {
      window.clearTimeout(abortHandle);
      abortHandle = undefined;
    }
  };
  const abortCurrentRequest = () => {
    if (listeners.size > 0) return;
    controller?.abort();
    controller = null;
    key = '';
    requestId += 1;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      clearDeferredAbort();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          abortHandle = window.setTimeout(() => {
            abortHandle = undefined;
            abortCurrentRequest();
          }, 0);
        }
      };
    },
    load: (
      nextKey: string,
      enabled: boolean,
      fallback: T | undefined,
      fetcher: (signal: AbortSignal) => Promise<T>,
    ) => {
      clearDeferredAbort();
      if (key === nextKey) return;
      key = nextKey;
      requestId += 1;
      controller?.abort();
      controller = null;

      if (!enabled) {
        update({ data: undefined, loading: false, error: null, usingFallback: false });
        return;
      }

      const currentRequest = requestId;
      const nextController = new AbortController();
      controller = nextController;
      update({ loading: true, error: null });

      fetcher(nextController.signal)
        .then((result) => {
          if (nextController.signal.aborted || currentRequest !== requestId) return;
          update({ data: result, loading: false, usingFallback: false });
          markApiOnline();
        })
        .catch((err: unknown) => {
          if (nextController.signal.aborted || currentRequest !== requestId) return;
          const apiErr = err instanceof ApiError ? err : new ApiError('Unknown error', 0, err);
          if (apiErr.status === 0) markApiOffline();
          update({
            data: fallback !== undefined ? fallback : snapshot.data,
            loading: false,
            error: apiErr,
            usingFallback: fallback !== undefined,
          });
        });
    },
  };
}

/** Fetch-on-mount query with graceful fallback to mock data. */
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions<T> = {},
): QueryState<T> {
  const { fallback, enabled = true, deps = [] } = options;
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  const storeRef = useRef<ReturnType<typeof createQueryStore<T>>>();
  fetcherRef.current = fetcher;
  if (!storeRef.current) storeRef.current = createQueryStore<T>();

  const key = `${enabled ? '1' : '0'}:${nonce}:${deps.map(queryKeyPart).join('|')}`;
  storeRef.current.load(key, enabled, fallback, (signal) => fetcherRef.current(signal));
  const snapshot = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    storeRef.current.getSnapshot,
  );
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { ...snapshot, refetch };
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
