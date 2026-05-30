import { useSyncExternalStore } from 'react';

/** Tracks whether live API calls are succeeding, to drive an offline banner. */
type ApiOnline = 'online' | 'offline' | 'unknown';

let state: ApiOnline = 'unknown';
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function markApiOnline() {
  if (state !== 'online') {
    state = 'online';
    emit();
  }
}

export function markApiOffline() {
  if (state !== 'offline') {
    state = 'offline';
    emit();
  }
}

export function useApiStatus(): ApiOnline {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
