import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { connectChatSocket } from './socket';
import { isVaultUnlocked, subscribeVault } from './keyStore';

type Snapshot = { socket: Socket | null; connected: boolean };
const empty: Snapshot = { socket: null, connected: false };
let snapshot = empty;
let started = false;
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const onConnect = () => { snapshot = { ...snapshot, connected: true }; emit(); };
const onDisconnect = () => { snapshot = { ...snapshot, connected: false }; emit(); };
function reset() {
  revision++;
  snapshot.socket?.off('connect', onConnect);
  snapshot.socket?.off('disconnect', onDisconnect);
  started = false;
  snapshot = empty;
  emit();
}
function start() {
  if (started || !listeners.size || !isVaultUnlocked()) return;
  started = true;
  const expected = revision;
  void connectChatSocket().then(socket => {
    if (expected !== revision || !socket || !isVaultUnlocked()) return;
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    snapshot = { socket, connected: socket.connected };
    emit();
  }).catch(() => { if (expected === revision) reset(); });
}
subscribeVault(() => { if (!isVaultUnlocked()) reset(); else start(); });
function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => { listeners.delete(listener); if (!listeners.size) reset(); };
}
export function useChatConnection() {
  return useSyncExternalStore(subscribe, () => snapshot, () => empty);
}
