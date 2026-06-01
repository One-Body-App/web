import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { connectChatSocket } from './socket';
import { ensureKeyRegistered } from './keyStore';

type ChatConnectionSnapshot = { socket: Socket | null; connected: boolean };

let snapshot: ChatConnectionSnapshot = { socket: null, connected: false };
let started = false;
let activeSocket: Socket | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());
const setSnapshot = (next: ChatConnectionSnapshot) => {
  snapshot = next;
  emit();
};

const onConnect = () => setSnapshot({ socket: activeSocket, connected: true });
const onDisconnect = () => setSnapshot({ socket: activeSocket, connected: false });

function ensureStarted() {
  if (started) return;
  started = true;
  ensureKeyRegistered().catch(() => {
    /* key registration is best-effort; surfaced per-send if it matters */
  });
  connectChatSocket()
    .then((socket) => {
      if (!socket) return;
      activeSocket = socket;
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      setSnapshot({ socket, connected: socket.connected });
    })
    .catch(() => {
      setSnapshot({ socket: null, connected: false });
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureStarted();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && activeSocket) {
      activeSocket.off('connect', onConnect);
      activeSocket.off('disconnect', onDisconnect);
      activeSocket = null;
      started = false;
      snapshot = { socket: null, connected: false };
    }
  };
}

/** Connects the chat socket and registers this device's E2EE key (idempotent). */
export function useChatConnection(): { socket: Socket | null; connected: boolean } {
  return useSyncExternalStore(subscribe, () => snapshot, () => ({ socket: null, connected: false }));
}
