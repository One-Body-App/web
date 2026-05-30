import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/api/config';
import { getAuthToken } from '@/api/token';

// Mobile derives the socket URL by stripping `/api` and appending the namespace.
const SOCKET_URL = `${API_BASE_URL.replace(/\/api\/?$/i, '').replace(/\/+$/, '')}/chat`;

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;

export async function connectChatSocket(): Promise<Socket | null> {
  if (socket) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const token = await getAuthToken();
    if (!token) {
      connecting = null;
      return null;
    }
    const sock = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionAttempts: 20,
      autoConnect: true,
      auth: { token },
    });
    // Refresh the (short-lived) Clerk token before each reconnect.
    sock.io.on('reconnect_attempt', () => {
      void getAuthToken().then((t) => {
        if (t) sock.auth = { token: t };
      });
    });
    socket = sock;
    return sock;
  })();

  return connecting;
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
  connecting = null;
}

/** Emit an event that expects a server ack, with a timeout (matches mobile 12s). */
export function emitWithAck<T = unknown>(event: string, payload: unknown, timeoutMs = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const sock = socket;
    if (!sock) {
      reject(new Error('Chat socket not connected'));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Chat request timed out'));
      }
    }, timeoutMs);
    sock.emit(event, payload, (ack: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    });
  });
}
