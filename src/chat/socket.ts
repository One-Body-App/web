import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/api/config';
import { getAuthToken } from '@/api/token';

// Mobile derives the socket URL by stripping `/api` and appending the namespace.
const SOCKET_URL = `${API_BASE_URL.replace(/\/api\/?$/i, '').replace(/\/+$/, '')}/chat`;

let generation = 0;
let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;

export async function connectChatSocket(): Promise<Socket | null> {
  if (socket) return socket;
  if (connecting) return connecting;

  const expected = generation;
  connecting = (async () => {
    const token = await getAuthToken();
    if (!token || expected !== generation) {
      if (expected === generation) connecting = null;
      return null;
    }
    const sock = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionAttempts: 20,
      autoConnect: true,
      auth: callback => {
        void getAuthToken().then(fresh => {
          if (generation === expected && fresh) callback({ token: fresh });
          else sock.disconnect();
        });
      },
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
  generation++;
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
