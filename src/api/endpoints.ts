import { api } from './client';
import { mapPrayer, type Prayer } from './prayer';
import { mapVideo, type WatchVideo } from './watch';
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

interface ApiComment {
  _id?: string;
  id?: string;
  commentId?: string;
  content?: string;
  user?: ApiUser;
  userData?: ApiUser;
  created?: string;
  createdAt?: string;
  date?: string;
  reactions?: ApiReaction[];
  reactionsCount?: number;
  repostCount?: number;
  bookmarkCount?: number;
  bookmarkedByMe?: boolean;
  // Nested replies (the API nests children under `response`).
  response?: unknown[];
  replyCount?: number;
  repliesCount?: number;
}

interface ApiSocialPost {
  _id?: string;
  id?: string;
  postId?: string;
  content?: string;
  images?: string[];
  videos?: string[];
  reactions?: ApiReaction[];
  reactionsCount?: number;
  comments?: unknown[];
  commentCount?: number;
  commentsCount?: number;
  commentNumber?: number;
  repostCount?: number;
  // The curated feed (OpenSearch) returns the author under `userData`; raw
  // social endpoints use `user`. Support both.
  user?: ApiUser;
  userData?: ApiUser;
  createdAt?: string;
  created?: string;
  date?: string;
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

// The API serves a placeholder avatar at cdn.../user/no-image.png; treat that
// (and blank values) as "no avatar" so we show our own fallback instead.
function resolveAvatar(profileImage?: string): string {
  const v = profileImage?.trim();
  if (v && !/no-image/i.test(v)) return v;
  return FALLBACK_AVATAR;
}

export function mapUser(u?: ApiUser | null): OBUser {
  return {
    id: u?._id ?? u?.id ?? 'unknown',
    name: u?.name ?? u?.username ?? 'One Body member',
    username: u?.username ?? 'member',
    avatar: resolveAvatar(u?.profileImage),
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
  const image = (p.images ?? []).find(
    (u): u is string => typeof u === 'string' && u.trim().length > 0 && !/no-image/i.test(u),
  );
  return {
    // Use the raw post id (postId) so reaction/comment writes target the post,
    // not the OpenSearch doc id ("onebody_...").
    id: p.postId ?? p._id ?? p.id ?? Math.random().toString(36).slice(2),
    author: mapUser(p.userData ?? p.user),
    createdAt: timeAgo(p.created ?? p.createdAt ?? p.date),
    body: p.content ?? '',
    image,
    reactions,
    myReaction,
    comments: p.commentsCount ?? p.commentNumber ?? p.commentCount ?? p.comments?.length ?? 0,
    reposts: p.repostCount ?? 0,
    saved: Boolean(p.saved),
    feeds: [],
  };
}

/* ----------------------------- Comments ----------------------------- */
export interface OBComment {
  id: string;
  author: OBUser;
  body: string;
  createdAt: string; // relative label
  reactions: number;
  reposts: number;
  replies: number;
  liked: boolean;
  bookmarked: boolean;
}

function mapComment(c: ApiComment, myUserId?: string): OBComment {
  const liked = (c.reactions ?? []).some((r) => myUserId != null && r.userId === myUserId);
  return {
    id: c.commentId ?? c._id ?? c.id ?? Math.random().toString(36).slice(2),
    author: mapUser(c.userData ?? c.user),
    body: c.content ?? '',
    createdAt: timeAgo(c.created ?? c.createdAt ?? c.date),
    reactions: c.reactionsCount ?? c.reactions?.length ?? 0,
    reposts: c.repostCount ?? 0,
    replies: c.repliesCount ?? c.replyCount ?? c.response?.length ?? 0,
    liked,
    bookmarked: Boolean(c.bookmarkedByMe),
  };
}

/* ----------------------------- RSS / articles ----------------------------- */
// The "Read" feed (NEWS_INDEX) returns RSS/news items, not social posts.
export interface OBArticle {
  id: string;
  title: string;
  summary?: string;
  image?: string;
  link: string;
  sourceName: string;
  sourceAvatar: string;
  time: string;
}

/** A heterogeneous feed entry — a social post, a blog/news article, or a video. */
export type OBFeedItem =
  | { kind: 'post'; post: OBPost }
  | { kind: 'article'; article: OBArticle }
  | { kind: 'video'; video: WatchVideo };

export type OBSearchItem = OBFeedItem | { kind: 'prayer'; prayer: Prayer };

interface ApiRssItem {
  _id?: string;
  id?: string;
  // Some feeds nest the title as an HTML-ish object ({ a: { $text } }).
  title?: string | { a?: { $text?: string } };
  description?: string;
  link?: string;
  image?: { url?: string } | string;
  date?: string;
  created?: string;
  author?: string;
  userData?: { name?: string; profileImage?: string };
}

function articleTitle(t: ApiRssItem['title']): string {
  if (typeof t === 'string') return t;
  if (t && typeof t === 'object') return t.a?.$text ?? '';
  return '';
}

function mapArticle(item: ApiRssItem): OBArticle | null {
  const link = item.link;
  const title = articleTitle(item.title).trim();
  if (!link || !title) return null;
  const image = typeof item.image === 'string' ? item.image : item.image?.url;
  return {
    id: item.id ?? item._id ?? link,
    title,
    summary: item.description?.replace(/<[^>]*>/g, '').trim() || undefined,
    image: image || undefined,
    link,
    sourceName: item.userData?.name ?? item.author ?? 'One Body',
    sourceAvatar: item.userData?.profileImage || FALLBACK_AVATAR,
    time: timeAgo(item.date ?? item.created),
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

function mapSearchItem(entry: unknown): OBSearchItem | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  const subtype = String(e.postSubtype ?? e.contentType ?? e.type ?? '').toLowerCase();
  const sourceIndex = String(e.sourceIndex ?? '').toLowerCase();

  if (subtype === 'prayer' || sourceIndex.includes('prayer')) {
    return { kind: 'prayer', prayer: mapPrayer(e) };
  }

  if (subtype === 'watch' || e.playBackId || e.playbackId || sourceIndex.includes('watch')) {
    const video = mapVideo(e);
    return video ? { kind: 'video', video } : null;
  }

  if (
    subtype === 'rss' ||
    subtype === 'blog' ||
    subtype === 'news' ||
    subtype === 'article' ||
    sourceIndex.includes('blog') ||
    sourceIndex.includes('news')
  ) {
    const article = mapArticle(e as ApiRssItem);
    return article ? { kind: 'article', article } : null;
  }

  const social = coerceSocialPost(entry);
  return social ? { kind: 'post', post: mapPost(social) } : null;
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

/** Content type for comments/reposts/saves (matches the API's object types). */
export type SocialContentType = 'social' | 'prayer' | 'rss';

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

  /** "Read" tab — RSS/news articles (NEWS_INDEX). */
  async getReadFeed(page = 1): Promise<OBArticle[]> {
    const payload = await api.get(`user/get-following-feed/read/${page}`);
    return unwrapList(payload)
      .map((x) => mapArticle(x as ApiRssItem))
      .filter((a): a is OBArticle => a !== null);
  },

  /**
   * Feed (For You / Connected / Pray) — heterogeneous: the curated feed mixes
   * social posts with blog/news articles. Maps each entry by contentType.
   */
  async getFeedItems(type: ApiFeedType, page = 1, myUserId?: string): Promise<OBFeedItem[]> {
    const payload = await api.get(`user/get-following-feed/${type}/${page}`);
    const items: OBFeedItem[] = [];
    for (const entry of unwrapList(payload)) {
      const e = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const contentType = String(e.contentType ?? e.type ?? '');
      if (contentType === 'blog' || contentType === 'news' || contentType === 'article') {
        const article = mapArticle(e as ApiRssItem);
        if (article) {
          items.push({ kind: 'article', article });
          continue;
        }
      }
      // Watch videos are mixed into the feed by the algorithm — render them inline.
      if (contentType === 'watch' || e.playBackId || e.playbackId) {
        const video = mapVideo(e);
        if (video) {
          items.push({ kind: 'video', video });
          continue;
        }
      }
      const social = coerceSocialPost(entry);
      if (social) items.push({ kind: 'post', post: mapPost(social, myUserId) });
    }
    return items;
  },

  async getFollowingSocial(page = 1, myUserId?: string): Promise<OBPost[]> {
    const payload = await api.get(`user/get-following-social/${page}`, { itemsPerPage: 10 });
    return unwrapList(payload).map((p) => mapPost(p as ApiSocialPost, myUserId));
  },

  /** Single post by id (powers the deep-linkable Post detail page). */
  async getPost(id: string, myUserId?: string): Promise<OBPost> {
    const payload = await api.get<ApiSocialPost>(`social/post/${id}`);
    return mapPost(payload, myUserId);
  },

  reactToPost: (postId: string, kind: ReactionKind) =>
    api.patch('social/react', { postId, type: KIND_TO_API[kind] }),

  removeReaction: (postId: string) => api.patch('social/remove-reaction', { postId }),

  createPost: (content: string, extra?: { gif?: unknown; location?: unknown }) =>
    api.post('social/post', { content, ...extra }),

  /**
   * Create a post with attached photos. Uses multipart/form-data so the API's
   * existing image upload pipeline kicks in. Mirrors how the mobile composer
   * submits.
   */
  createPostWithMedia: (params: {
    content: string;
    images: File[];
    mentionedUserIds?: string[];
    gif?: unknown;
    location?: { coordinates: number[]; name: string };
  }) => {
    const form = new FormData();
    form.append('content', params.content);
    if (params.mentionedUserIds) {
      params.mentionedUserIds.forEach((id) => form.append('mentionedUserIds[]', id));
    }
    if (params.gif) form.append('gif', JSON.stringify(params.gif));
    if (params.location) form.append('location', JSON.stringify(params.location));
    params.images.forEach((file) => form.append('images', file, file.name));
    return api.post<{ postId?: string; _id?: string; id?: string; pendingReview?: boolean }>(
      'social/post',
      form
    );
  },

  /* --- Comments (GET list / POST add / reply) --- */
  async getComments(
    postId: string,
    type: SocialContentType = 'social',
    page = 1,
    myUserId?: string,
  ): Promise<OBComment[]> {
    const payload = await api.get(`comments/${type}/${postId}`, { page });
    return unwrapList(payload).map((c) => mapComment(c as ApiComment, myUserId));
  },
  /**
   * Drill into a single comment: returns the comment itself plus its direct
   * replies (the API nests them under `response`). Powers X-style threads.
   */
  async getCommentThread(
    postId: string,
    commentId: string,
    type: SocialContentType = 'social',
    myUserId?: string,
  ): Promise<{ root: OBComment; replies: OBComment[] }> {
    const payload = await api.get<ApiComment>(`comments/${type}/${postId}/${commentId}`);
    const rawReplies = Array.isArray(payload.response) ? (payload.response as ApiComment[]) : [];
    return {
      root: mapComment(payload, myUserId),
      replies: rawReplies.map((c) => mapComment(c, myUserId)),
    };
  },
  addComment: (
    postId: string,
    content: string,
    type: SocialContentType = 'social',
    parentCommentId?: string,
  ) =>
    api
      .post<ApiComment>(
        `comments/${type}/${postId}`,
        parentCommentId ? { content, parentCommentId, replyToCommentId: parentCommentId } : { content },
      )
      .then((c) => mapComment(c)),

  /* --- Per-comment interactions (like / bookmark) --- */
  reactToComment: (postId: string, commentId: string, type: SocialContentType = 'social') =>
    api.patch(`comments/${type}/${postId}/${commentId}/reaction`, { type: 'love' }),
  removeCommentReaction: (postId: string, commentId: string, type: SocialContentType = 'social') =>
    api.del(`comments/${type}/${postId}/${commentId}/reaction`),
  bookmarkComment: (postId: string, commentId: string, type: SocialContentType = 'social') =>
    api.patch(`comments/${type}/${postId}/${commentId}/bookmark`),
  unbookmarkComment: (postId: string, commentId: string, type: SocialContentType = 'social') =>
    api.del(`comments/${type}/${postId}/${commentId}/bookmark`),

  /* --- Repost (no un-repost). `quoteContent` turns it into a quote repost. --- */
  repost: (
    sourceId: string,
    sourceType: SocialContentType | 'comment' = 'social',
    quoteContent?: string,
  ) =>
    api.post('social/repost', {
      sourceType,
      sourceId,
      ...(quoteContent ? { quoteContent } : {}),
    }),

  /* --- Save / bookmark --- */
  savePost: (body: {
    postId: string;
    type?: SocialContentType;
    title?: string;
    image?: string;
    createdAt?: string;
    userId?: string;
    link?: string;
  }) => api.post('user/save-post', { type: 'social', ...body }),
  unsavePost: (postId: string, type: SocialContentType = 'social') =>
    api.del('user/remove-saved-post', { id: postId, type }),

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

  async searchContent(text: string): Promise<OBSearchItem[]> {
    const payload = await api.post('user/search', { text, type: 'posts', limit: 24 });
    return unwrapList(payload)
      .map(mapSearchItem)
      .filter((item): item is OBSearchItem => item !== null);
  },

  async getSuggestedUsers(): Promise<OBUser[]> {
    const payload = await api.get('user/get-users-to-subscribe/1', { itemsPerPage: 10 });
    return unwrapList(payload).map((u) => mapUser(u as ApiUser));
  },

  /** Trending interest tags — scored from feed telemetry (tags/interest?sort=trending). */
  async getTrendingTags(): Promise<{ tag: string; posts: string; popularity: number; hot?: boolean }[]> {
    const payload = await api.get('tags/interest', { sort: 'trending', limit: 24 });
    const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);
    const tags: { tag: string; posts: string; popularity: number; hot?: boolean }[] = [];
    const items = unwrapList(payload);
    for (let i = 0; i < items.length; i += 1) {
      const r = items[i] as Record<string, unknown>;
      const name = String(r.name ?? r.title ?? '').trim();
      const tag = name.replace(/\s+/g, '');
      if (!tag) continue;
      const popularity = typeof r.popularity === 'number' ? r.popularity : 0;
      tags.push({
        tag,
        posts: popularity > 0 ? fmt(popularity) : '',
        popularity,
        hot: i < 3,
      });
    }
    return tags;
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
