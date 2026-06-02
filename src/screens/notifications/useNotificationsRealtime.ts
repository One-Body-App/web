import { useRef, useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { connectChatSocket } from '@/chat/socket';

// The API has no dedicated notification socket event (the only gateway is `/chat`). Until an additive
// `notification:*` emit exists server-side, we approximate realtime by refetching when the chat socket
// reports notification-generating activity, and whenever the tab is refocused. Modeled as a
// useSyncExternalStore store (web forbids useEffect) following the web/src/chat/useChat.ts pattern.

const REFRESH_EVENTS = ['chat:new_message', 'chat:new_group_message', 'chat:message_reaction'];
const DEBOUNCE_MS = 800;

let revision = 0;
let started = false;
let socketRef: Socket | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const bumpRevision = () => {
  if (debounceTimer !== undefined) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    revision += 1;
    emit();
  }, DEBOUNCE_MS);
};

const onWindowFocus = () => bumpRevision();
const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') bumpRevision();
};

function start() {
  if (started) return;
  started = true;
  window.addEventListener('focus', onWindowFocus);
  document.addEventListener('visibilitychange', onVisibilityChange);
  connectChatSocket()
    .then((socket) => {
      // Bail if every consumer unmounted while connecting.
      if (!socket || !started) return;
      socketRef = socket;
      REFRESH_EVENTS.forEach((event) => socket.on(event, bumpRevision));
    })
    .catch(() => {
      /* socket is best-effort; window focus still drives refreshes */
    });
}

function stop() {
  started = false;
  window.removeEventListener('focus', onWindowFocus);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (socketRef) {
    REFRESH_EVENTS.forEach((event) => socketRef?.off(event, bumpRevision));
    socketRef = null;
  }
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    // Never disconnect the shared chat socket; just drop our own listeners.
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => revision;

/** Invokes `onRefresh` when realtime activity (chat events / tab refocus) suggests new notifications. */
export function useNotificationsRealtime(onRefresh: () => void) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const lastHandledRef = useRef(current);
  if (current !== lastHandledRef.current) {
    lastHandledRef.current = current;
    onRefresh();
  }
}
