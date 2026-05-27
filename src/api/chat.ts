import { api } from './client';

/* ----------------------------- Types ----------------------------- */
export interface ChatConversation {
  id: string;
  conversationType: 'direct' | 'group';
  peerUserId?: string;
  groupId?: string;
  name: string;
  username?: string;
  avatar?: string;
  lastMessagePreview: string;
  updatedAt: string;
  unread: number;
}

/** Raw message as delivered by REST history or the socket. */
export interface RawChatMessage {
  _id?: string;
  senderId?: string;
  receiverId?: string;
  groupId?: string;
  conversationType?: 'direct' | 'group';
  encryptedPayload?: string;
  nonce?: string;
  authTag?: string;
  plaintextPayload?: string;
  messageType?: 'text' | 'image' | 'gif' | 'images';
  status?: 'sent' | 'delivered' | 'read';
  createdAt?: string;
  updatedAt?: string;
  clientMessageId?: string;
  senderName?: string;
  senderUsername?: string;
  senderAvatarUri?: string;
}

type Raw = Record<string, unknown>;
function unwrap(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  if (payload && typeof payload === 'object') {
    const o = payload as Raw;
    for (const k of ['data', 'items', 'messages', 'conversations', 'content']) {
      if (Array.isArray(o[k])) return o[k] as Raw[];
    }
  }
  return [];
}
const s = (v: unknown) => (typeof v === 'string' ? v : undefined);

function mapConversation(c: Raw): ChatConversation {
  const type = c.conversationType === 'group' ? 'group' : 'direct';
  return {
    id: String(c.id ?? c._id ?? c.peerUserId ?? c.groupId ?? ''),
    conversationType: type,
    peerUserId: s(c.peerUserId),
    groupId: s(c.groupId),
    name: s(c.groupName) ?? s(c.peerName) ?? 'Conversation',
    username: s(c.peerUsername),
    avatar: s(c.peerAvatarUri),
    lastMessagePreview: s(c.lastMessagePreview) ?? '',
    updatedAt: s(c.updatedAt) ?? '',
    unread: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
  };
}

/* ----------------------------- Endpoints ----------------------------- */
export const chatApi = {
  async conversations(): Promise<ChatConversation[]> {
    const payload = await api.get('chat/conversations', {
      limit: 100,
      includeGroups: true,
      includeArchived: false,
    });
    return unwrap(payload).map(mapConversation);
  },

  async directMessages(peerUserId: string, limit = 50): Promise<RawChatMessage[]> {
    return unwrap(await api.get(`chat/conversations/${peerUserId}/messages`, { limit })) as RawChatMessage[];
  },

  async groupMessages(groupId: string, limit = 50): Promise<RawChatMessage[]> {
    return unwrap(await api.get(`chat/groups/${groupId}/messages`, { limit })) as RawChatMessage[];
  },

  markConversationRead: (peerUserId: string) =>
    api.patch(`chat/conversations/${peerUserId}/read`),

  // E2EE keys
  registerKey: (body: { publicKey: string; algorithm: string; keyVersion: number; deviceId: string }) =>
    api.post<{ data?: unknown }>('chat/keys/register', body),

  async peerKey(userId: string): Promise<{ publicKey: string; keyVersion: number } | null> {
    const res = await api.get<{ data?: { publicKey?: string; keyVersion?: number } }>(`chat/keys/${userId}`);
    const data = res?.data;
    if (data?.publicKey) return { publicKey: data.publicKey, keyVersion: data.keyVersion ?? 1 };
    return null;
  },
};
