import { api } from './client';
import type { ChatMessage, Conversation, OBNotification, OBPost, OBUser, ReactionKind } from '@/data/mock';

/* ----------------------------- Raw API shapes ----------------------------- */
interface ApiUser {
  _id?: string;
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  bio?: string;
  profileImage?: string;
  accountType?: 'individual' | 'organization';
  isVerified?: boolean;
  following?: unknown[];
  followers?: unknown[];
}

interface ApiReaction {
  type?: string;
  userId?: string;
}

interface ApiSocialPost {
  _id?: string;
  id?: string;
  content?: string;
  images?: string[];
  videos?: string[];
  reactions?: ApiReaction[];
  comments?: unknown[];
  commentCount?: number;
  repostCount?: number;
  user?: ApiUser;
  createdAt?: string;
  saved?: boolean;
}

/* ----------------------------- Reaction mapping ----------------------------- */
// UI kind -> API ReactionType (api/src/modules/global/entities/reaction.entity.ts)
const KIND_TO_API: Record<ReactionKind, string> = {
  love: 'love',
  pray: 'praying',
  rejoice: 'praise',
};
const API_TO_KIND: Record<string, ReactionKind> = {
  love: 'love',
  like: 'love',
  praying: 'pray',
  praise: 'rejoice',
  happy: 'rejoice',
};

/* ----------------------------- Helpers ----------------------------- */
const FALLBACK_AVATAR = '/brand/avatar1.png';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function mapUser(u?: ApiUser | null): OBUser {
  return {
    id: u?._id ?? u?.id ?? 'unknown',
    name: u?.name ?? u?.username ?? 'One Body member',
    username: u?.username ?? 'member',
    avatar: u?.profileImage || FALLBACK_AVATAR,
    verified: Boolean(u?.isVerified),
    kind: u?.accountType === 'organization' ? 'church' : 'member',
    bio: u?.bio,
  };
}

function mapPost(p: ApiSocialPost, myUserId?: string): OBPost {
  const reactions = { love: 0, pray: 0, rejoice: 0 };
  let myReaction: ReactionKind | null = null;
  for (const r of p.reactions ?? []) {
    const kind = r.type ? API_TO_KIND[r.type] : undefined;
    if (kind) {
      reactions[kind] += 1;
      if (myUserId && r.userId === myUserId) myReaction = kind;
    }
  }
  return {
    id: p._id ?? p.id ?? Math.random().toString(36).slice(2),
    author: mapUser(p.user),
    createdAt: timeAgo(p.createdAt),
    body: p.content ?? '',
    image: p.images?.[0],
    reactions,
    myReaction,
    comments: p.commentCount ?? p.comments?.length ?? 0,
    reposts: p.repostCount ?? 0,
    saved: Boolean(p.saved),
    feeds: [],
  };
}

/** The feed endpoint returns heterogeneous entries; pull out social posts. */
function coerceSocialPost(entry: unknown): ApiSocialPost | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  if ('content' in e || 'reactions' in e || ('user' in e && 'images' in e)) {
    return e as ApiSocialPost;
  }
  if (e.data && typeof e.data === 'object') return coerceSocialPost(e.data);
  if (e.post && typeof e.post === 'object') return coerceSocialPost(e.post);
  if (e.social && typeof e.social === 'object') return coerceSocialPost(e.social);
  return null;
}

function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.content)) return obj.content;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

/* ----------------------------- Endpoints ----------------------------- */
export type ApiFeedType = 'connected' | 'foryou' | 'pray' | 'read' | 'watch';

export interface MyProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio?: string;
  followers: number;
  following: number;
  accountType?: string;
}

export const endpoints = {
  syncClerkUser: (body: { name?: string; username?: string; accountType?: string }) =>
    api.post<{ user: ApiUser }>('auth/clerk/sync', body),

  /** Public pre-check (mirrors mobile): resolves if available, throws ApiError(409) if taken. */
  checkUsername: (username: string) => api.post<boolean>('user/validateUsername', { username }),

  async getFeed(type: ApiFeedType, page = 1, myUserId?: string): Promise<OBPost[]> {
    const payload = await api.get(`user/get-following-feed/${type}/${page}`);
    return unwrapList(payload)
      .map(coerceSocialPost)
      .filter((p): p is ApiSocialPost => p !== null)
      .map((p) => mapPost(p, myUserId));
  },

  async getFollowingSocial(page = 1, myUserId?: string): Promise<OBPost[]> {
    const payload = await api.get(`user/get-following-social/${page}`, { itemsPerPage: 10 });
    return unwrapList(payload).map((p) => mapPost(p as ApiSocialPost, myUserId));
  },

  reactToPost: (postId: string, kind: ReactionKind) =>
    api.patch('social/react', { postId, type: KIND_TO_API[kind] }),

  removeReaction: (postId: string) => api.patch('social/remove-reaction', { postId }),

  createPost: (content: string, extra?: { gif?: unknown; location?: unknown }) =>
    api.post('social/post', { content, ...extra }),

  getMyProfile: () => api.get<ApiUser>('user/my-profile', { pullSavedData: false }),

  async getMyProfileMapped(): Promise<MyProfile> {
    const u = await api.get<ApiUser>('user/my-profile', { pullSavedData: false });
    return {
      id: u._id ?? u.id ?? '',
      name: u.name ?? u.username ?? 'One Body member',
      username: u.username ?? 'member',
      avatar: u.profileImage || FALLBACK_AVATAR,
      bio: u.bio,
      followers: Array.isArray(u.followers) ? u.followers.length : 0,
      following: Array.isArray(u.following) ? u.following.length : 0,
      accountType: u.accountType,
    };
  },

  async getUserPosts(userId: string, page = 1, myUserId?: string): Promise<OBPost[]> {
    const payload = await api.get(`user/get-social/onebody/${userId}/${page}`, { itemsPerPage: 12 });
    return unwrapList(payload).map((p) => mapPost(p as ApiSocialPost, myUserId));
  },

  async searchUsers(text: string): Promise<OBUser[]> {
    const payload = await api.post('user/search', { text, type: 'users', limit: 20 });
    return unwrapList(payload).map((u) => mapUser(u as ApiUser));
  },

  async getSuggestedUsers(): Promise<OBUser[]> {
    const payload = await api.get('user/get-users-to-subscribe/1', { itemsPerPage: 10 });
    return unwrapList(payload).map((u) => mapUser(u as ApiUser));
  },

  followUser: (id: string) => api.patch(`user/subscribe/${id}`),
  unfollowUser: (id: string) => api.patch(`user/unsubscribe/${id}`),

  async getNotifications(): Promise<OBNotification[]> {
    const payload = await api.get<{ data?: unknown[] }>('user/notifications');
    return unwrapList(payload).map((n) => mapNotification(n as Record<string, unknown>));
  },
  markAllNotificationsRead: () => api.patch('user/notifications/read-all'),

  // Chat (best-effort REST; mobile also uses sockets for realtime).
  async getConversations(): Promise<Conversation[]> {
    const payload = await api.get('chat/conversations');
    return unwrapList(payload).map((c) => mapConversation(c as Record<string, unknown>));
  },
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const payload = await api.get(`chat/conversations/${conversationId}/messages`);
    return unwrapList(payload).map((m) => mapMessage(m as Record<string, unknown>));
  },
};

/* ----------------------------- Misc mappers ----------------------------- */
function mapNotification(n: Record<string, unknown>): OBNotification {
  const actor = (n.actor ?? n.fromUser ?? n.user) as ApiUser | undefined;
  const kindRaw = String(n.type ?? n.kind ?? 'reaction').toLowerCase();
  const kind: OBNotification['kind'] = (['reaction', 'comment', 'follow', 'prayer', 'mention'] as const).includes(
    kindRaw as OBNotification['kind'],
  )
    ? (kindRaw as OBNotification['kind'])
    : 'reaction';
  return {
    id: String(n._id ?? n.id ?? Math.random()),
    user: mapUser(actor),
    kind,
    text: String(n.message ?? n.text ?? 'sent you a notification'),
    time: timeAgo(String(n.createdAt ?? '')),
    unread: n.read !== true && n.isRead !== true,
  };
}

function mapConversation(c: Record<string, unknown>): Conversation {
  return {
    id: String(c._id ?? c.id ?? Math.random()),
    user: mapUser((c.user ?? c.otherUser ?? c.participant) as ApiUser),
    lastMessage: String((c.lastMessage as Record<string, unknown>)?.text ?? c.lastMessage ?? ''),
    time: timeAgo(String(c.updatedAt ?? c.createdAt ?? '')),
    unread: Number(c.unreadCount ?? 0),
  };
}

function mapMessage(m: Record<string, unknown>): ChatMessage {
  return {
    id: String(m._id ?? m.id ?? Math.random()),
    fromMe: Boolean(m.fromMe ?? m.isMine),
    text: String(m.text ?? m.content ?? ''),
    time: timeAgo(String(m.createdAt ?? '')),
  };
}
