import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectChatSocket } from './socket';
import { ensureKeyRegistered } from './keyStore';

/** Connects the chat socket and registers this device's E2EE key (idempotent). */
export function useChatConnection(): { socket: Socket | null; connected: boolean } {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    ensureKeyRegistered().catch(() => {
      /* key registration is best-effort; surfaced per-send if it matters */
    });

    let sock: Socket | null = null;
    const onConnect = () => active && setConnected(true);
    const onDisconnect = () => active && setConnected(false);

    connectChatSocket()
      .then((s) => {
        if (!s || !active) return;
        sock = s;
        setSocket(s);
        setConnected(s.connected);
        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);
      })
      .catch(() => {});

    return () => {
      active = false;
      if (sock) {
        sock.off('connect', onConnect);
        sock.off('disconnect', onDisconnect);
      }
    };
  }, []);

  return { socket, connected };
}
