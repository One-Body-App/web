import { api } from './client';
import { mapPrayer, type Prayer } from './prayer';
import {
  createReactionCounts,
  getApiReactionType,
  getReactionKindFromApi,
  getReactionTotal,
  type FullReactionKind,
  type ReactionCounts,
} from './reactions';
import { mapVideo, type WatchVideo } from './watch';
import type { VerseResult } from './scripture';
import type {
  ChatMessage,
  Conversation,
  OBPost,
  OBPostRepost,
  OBUser,
  ReactionKind,
} from '@/data/mock';
import type { InboxNotification, NotificationKind } from '@/screens/notifications/types';

export interface NotificationSettings {
  pushNotificationsEnabled: boolean;
  connectionNotificationsEnabled: boolean;
  tagNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  allowDirectMessages: boolean;
  subscribedToNewsletter: boolean;
}

/* ----------------------------- Raw API shapes ----------------------------- */
interface ApiUser {
  _id?: string;
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  bio?: string;
  favoriteVerse?: VerseResult;
  website?: string;
  createdAt?: string;
  profileImage?: string;
  accountType?: 'individual' | 'organization';
  emailVerified?: boolean;
  isProfileCompleted?: boolean | string;
  profile?: {
    dateOfBirth?: string;
    gender?: string;
    churchType?: string;
    churchSubType?: string;
    churchAttendance?: string;
    oftenChurch?: string;
    isChurchTypePublic?: boolean;
    isLocationPublic?: boolean;
    location?: {
      address?: string;
      coordinates?: {
        lon?: number;
        lat?: number;
      };
      point?: {
        coordinates?: number[];
      };
    };
    whatIDo?: {
      _id?: string;
      id?: string;
      name?: string;
    };
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhoneNumber?: string;
    organizationCategory?: string;
    organizationSubType?: string;
    organizationSize?: string;
    typeOfOrganization?: {
      _id?: string;
      id?: string;
      name?: string;
      organizationType?: string;
      category?: string;
    };
  };
  mfaConfig?: {
    isMfaActive?: boolean | null;
    defaultMethod?: MfaMethod;
  };
  interests?: Array<{ _id?: string; id?: string; name?: string } | string>;
  influencerProfile?: {
    influencerStatus?: string;
  };
  isVerified?: boolean;
  following?: unknown[];
  followers?: unknown[];
}

interface ApiReaction {
  type?: string;
  userId?: string | { _id?: string; id?: string };
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
  scriptureShare?: OBPost['scriptureShare'];
  // The curated feed (OpenSearch) returns the author under `userData`; raw
  // social endpoints use `user`. Support both.
  user?: ApiUser;
  userData?: ApiUser;
  createdAt?: string;
  created?: string;
  date?: string;
  saved?: boolean;
  repost?: ApiRepost;
}

interface ApiRepost {
  sourceType?: string;
  sourceId?: string;
  sourceObjectType?: string;
  sourceObjectId?: string;
  sourceCommentId?: string;
  sourceAuthorName?: string;
  sourceAuthorUsername?: string;
  sourceAuthorProfileImage?: string;
  sourceCreatedAt?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  sourceContent?: string;
  sourceContentSnippet?: string;
  sourceLink?: string;
  sourceImage?: string;
  sourceImages?: unknown;
  sourceCategory?: string;
  repostType?: string;
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

function idFromValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const id = record._id ?? record.id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

function reactionUserId(reaction: ApiReaction): string {
  return idFromValue(reaction.userId);
}

function mapReactionState(
  reactionsArr: ApiReaction[] | undefined,
  myUserId?: string,
): { counts: ReactionCounts; myReaction: FullReactionKind | null; total: number } {
  const counts = createReactionCounts();
  let myReaction: FullReactionKind | null = null;
  for (const reaction of reactionsArr ?? []) {
    const kind = getReactionKindFromApi(reaction.type);
    if (!kind) continue;
    counts[kind] += 1;
    if (myUserId && reactionUserId(reaction) === myUserId) {
      myReaction = kind;
    }
  }
  return { counts, myReaction, total: getReactionTotal(counts) };
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
      if (myUserId && reactionUserId(r) === myUserId) myReaction = kind;
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
    scriptureMentions: (p as { scriptureMentions?: OBPost['scriptureMentions'] })
      .scriptureMentions,
    scriptureShare: p.scriptureShare,
    reactions,
    myReaction,
    comments: p.commentsCount ?? p.commentNumber ?? p.commentCount ?? p.comments?.length ?? 0,
    reposts: p.repostCount ?? 0,
    saved: Boolean(p.saved),
    feeds: [],
    repost: mapRepost(p.repost),
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeSourceType(value?: string): OBPostRepost['sourceType'] | undefined {
  if (value === 'social' || value === 'prayer' || value === 'rss' || value === 'watch' || value === 'comment') {
    return value;
  }
  return undefined;
}

function normalizeSourceObjectType(value?: string): OBPostRepost['sourceObjectType'] | undefined {
  if (value === 'social' || value === 'prayer' || value === 'rss' || value === 'watch') {
    return value;
  }
  return undefined;
}

function normalizeRepostType(value?: string): OBPostRepost['repostType'] | undefined {
  if (value === 'quote' || value === 'repost') return value;
  return undefined;
}

function mapRepost(repost?: ApiRepost): OBPostRepost | undefined {
  const sourceType = normalizeSourceType(repost?.sourceType);
  const sourceId = repost?.sourceId?.trim();
  if (!sourceType || !sourceId) return undefined;
  return {
    sourceType,
    sourceId,
    sourceObjectType: normalizeSourceObjectType(repost?.sourceObjectType),
    sourceObjectId: repost?.sourceObjectId || undefined,
    sourceCommentId: repost?.sourceCommentId || undefined,
    sourceAuthorName: repost?.sourceAuthorName || undefined,
    sourceAuthorUsername: repost?.sourceAuthorUsername || undefined,
    sourceAuthorProfileImage: resolveAvatar(repost?.sourceAuthorProfileImage),
    sourceCreatedAt: repost?.sourceCreatedAt ? timeAgo(repost.sourceCreatedAt) : undefined,
    sourceTitle: repost?.sourceTitle || undefined,
    sourceDescription: repost?.sourceDescription || undefined,
    sourceContent: repost?.sourceContent || undefined,
    sourceContentSnippet: repost?.sourceContentSnippet || undefined,
    sourceLink: repost?.sourceLink || undefined,
    sourceImage: repost?.sourceImage || undefined,
    sourceImages: toStringArray(repost?.sourceImages),
    sourceCategory: repost?.sourceCategory || undefined,
    repostType: normalizeRepostType(repost?.repostType),
  };
}

/* ----------------------------- Comments ----------------------------- */
export interface OBComment {
  id: string;
  author: OBUser;
  body: string;
  createdAt: string; // relative label
  reactions: number;
  reactionCounts: ReactionCounts;
  myReaction: FullReactionKind | null;
  reposts: number;
  replies: number;
  liked: boolean;
  bookmarked: boolean;
}

function mapComment(c: ApiComment, myUserId?: string): OBComment {
  const reactionState = mapReactionState(c.reactions, myUserId);
  return {
    id: c.commentId ?? c._id ?? c.id ?? Math.random().toString(36).slice(2),
    author: mapUser(c.userData ?? c.user),
    body: c.content ?? '',
    createdAt: timeAgo(c.created ?? c.createdAt ?? c.date),
    reactions: c.reactionsCount ?? reactionState.total,
    reactionCounts: reactionState.counts,
    myReaction: reactionState.myReaction,
    reposts: c.repostCount ?? 0,
    replies: c.repliesCount ?? c.replyCount ?? c.response?.length ?? 0,
    liked: Boolean(reactionState.myReaction),
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

function normalizeArticleImage(image: ApiRssItem['image']): string | undefined {
  const rawImage = typeof image === 'string' ? image : image?.url;
  const trimmed = rawImage?.trim();
  if (!trimmed || /no-image/i.test(trimmed)) return undefined;
  return trimmed;
}

function mapArticle(item: ApiRssItem): OBArticle | null {
  const link = item.link;
  const title = articleTitle(item.title).trim();
  if (!link || !title) return null;
  const image = normalizeArticleImage(item.image);
  return {
    id: item.id ?? item._id ?? link,
    title,
    summary: item.description?.replace(/<[^>]*>/g, '').trim() || undefined,
    image,
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
export type CommentContentType = SocialContentType | 'watch';

export type MfaMethod = 'passkey' | 'totp' | 'email' | 'backup';

export interface MfaChallengeResponse {
  mfaRequired: true;
  enrollmentRequired: boolean;
  mfaToken: string;
  preferredMethod: MfaMethod;
  availableMethods: MfaMethod[];
  emailMasked: string;
  reason: 'mandatory_mfa' | 'step_up';
}

export interface OrganizationType {
  _id: string;
  id?: string;
  name?: string;
  organizationType?: string;
  category?: string;
}

export interface InterestTag {
  _id: string;
  id?: string;
  name: string;
}

export interface ChurchType {
  _id: string;
  id?: string;
  name: string;
}

export interface AuthApiTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
}

export interface AuthApiResult {
  user?: ApiUser;
  tokens?: AuthApiTokens;
  backupCodes?: string[];
}

export interface MyProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  email?: string;
  emailVerified: boolean;
  isProfileCompleted: boolean;
  mfaConfig?: {
    isMfaActive?: boolean | null;
    defaultMethod?: MfaMethod;
  };
  bio?: string;
  favoriteVerse?: VerseResult;
  website?: string;
  joinedYear?: number;
  followers: number;
  following: number;
  followingIds: string[];
  accountType?: 'individual' | 'organization' | string;
  profile?: ApiUser['profile'];
  interests: Array<{ id: string; name: string }>;
  influencerProfile?: {
    influencerStatus?: string;
  };
}

function resolveProfileCompleted(u: ApiUser): boolean {
  if (u.isProfileCompleted === true) return true;
  if (typeof u.isProfileCompleted === 'string') {
    return u.isProfileCompleted.toLowerCase() === 'true';
  }
  return false;
}

function parseJoinedYear(createdAt?: string): number | undefined {
  if (!createdAt) return undefined;
  const year = new Date(createdAt).getFullYear();
  return Number.isFinite(year) ? year : undefined;
}

function resolveUserId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const candidate = record._id ?? record.id ?? record.userId ?? record.$oid;
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate).trim();
  }
  if (candidate && typeof candidate === 'object') {
    const nested = candidate as Record<string, unknown>;
    const nestedCandidate = nested._id ?? nested.id ?? nested.userId ?? nested.$oid;
    return typeof nestedCandidate === 'string' || typeof nestedCandidate === 'number'
      ? String(nestedCandidate).trim()
      : '';
  }
  return '';
}

function mapMyProfile(u: ApiUser): MyProfile {
  return {
    id: u._id ?? u.id ?? '',
    name: u.name ?? u.username ?? 'One Body member',
    username: u.username ?? 'member',
    avatar: u.profileImage || FALLBACK_AVATAR,
    email: u.email,
    emailVerified: u.emailVerified === true,
    isProfileCompleted: resolveProfileCompleted(u),
    mfaConfig: u.mfaConfig,
    bio: u.bio,
    favoriteVerse: u.favoriteVerse,
    website: u.website,
    joinedYear: parseJoinedYear(u.createdAt),
    followers: Array.isArray(u.followers) ? u.followers.length : 0,
    following: Array.isArray(u.following) ? u.following.length : 0,
    followingIds: Array.isArray(u.following)
      ? u.following.map(resolveUserId).filter((id) => id.length > 0)
      : [],
    accountType: u.accountType,
    profile: u.profile,
    interests: (u.interests ?? []).map((interest) =>
      typeof interest === 'string'
        ? { id: interest, name: interest }
        : {
            id: interest._id ?? interest.id ?? '',
            name: interest.name ?? '',
          },
    ),
    influencerProfile: u.influencerProfile,
  };
}

export const endpoints = {
  syncClerkUser: (
    body: { name?: string; username?: string; accountType?: string },
    signal?: AbortSignal,
  ) => api.post<{ user: ApiUser }>('auth/clerk/sync', body, undefined, signal),

  beginMfaOnboarding: () =>
    api.post<MfaChallengeResponse | { mfaRequired: false }>('auth/mfa/onboarding/begin'),
  beginPasskeyRegistration: (body: { mfaToken: string; deviceName?: string }) =>
    api.post<PublicKeyCredentialCreationOptions>('auth/mfa/passkey/register/begin', body),
  finishPasskeyRegistration: (body: { mfaToken: string; response: Record<string, unknown> }) =>
    api.post<AuthApiResult>('auth/mfa/passkey/register/finish', body),
  beginPasskeyLogin: (body: { mfaToken: string }) =>
    api.post<PublicKeyCredentialRequestOptions>('auth/mfa/passkey/login/begin', body),
  finishPasskeyLogin: (body: { mfaToken: string; response: Record<string, unknown> }) =>
    api.post<AuthApiResult>('auth/mfa/passkey/login/finish', body),
  beginTotpSetup: (body: { mfaToken: string }) =>
    api.post<{ otpauth: string }>('auth/mfa/totp/setup/begin', body),
  verifyTotpSetup: (body: { mfaToken: string; code: string }) =>
    api.post<AuthApiResult>('auth/mfa/totp/setup/verify', body),
  verifyTotpCode: (body: { mfaToken: string; code: string }) =>
    api.post<AuthApiResult>('auth/mfa/totp/verify', body),
  sendEmailMfaCode: (body: { mfaToken: string }) =>
    api.post<{ sent: boolean }>('auth/mfa/email/send', body),
  verifyEmailMfaCode: (body: { mfaToken: string; code: string }) =>
    api.post<AuthApiResult>('auth/mfa/email/verify', body),
  verifyBackupCode: (body: { mfaToken: string; code: string }) =>
    api.post<AuthApiResult>('auth/mfa/backup/verify', body),

  getInterestTags: async (): Promise<InterestTag[]> => {
    const payload = await api.get('tags/interest');
    return unwrapList(payload)
      .map((item): InterestTag | null => {
        const record = item as Record<string, unknown>;
        const id = String(record._id ?? record.id ?? '').trim();
        const name = String(record.name ?? record.title ?? '').trim();
        return id && name ? { _id: id, id, name } : null;
      })
      .filter((item): item is InterestTag => item !== null);
  },

  // Mirrors mobile's GET tags/professions. Used by the Edit Profile "What I do"
  // picker. Same shape as interest tags.
  getProfessionTags: async (): Promise<InterestTag[]> => {
    const payload = await api.get('tags/professions');
    return unwrapList(payload)
      .map((item): InterestTag | null => {
        const record = item as Record<string, unknown>;
        const id = String(record._id ?? record.id ?? '').trim();
        const name = String(record.name ?? record.title ?? '').trim();
        return id && name ? { _id: id, id, name } : null;
      })
      .filter((item): item is InterestTag => item !== null);
  },

  // Mirrors mobile's GET global/church-type. Used by the (currently hidden)
  // ChurchTypeStep — see src/screens/onboarding/OnboardingStepper.tsx HIDDEN_STEPS.
  getChurchTypes: async (): Promise<ChurchType[]> => {
    const payload = await api.get('global/church-type');
    return unwrapList(payload)
      .map((item): ChurchType | null => {
        const record = item as Record<string, unknown>;
        const id = String(record._id ?? record.id ?? '').trim();
        const name = String(record.name ?? record.churchType ?? record.title ?? '').trim();
        return id && name ? { _id: id, id, name } : null;
      })
      .filter((item): item is ChurchType => item !== null);
  },

  getOrganizationTypes: async (): Promise<OrganizationType[]> => {
    const payload = await api.get('global/OrganizationType');
    return unwrapList(payload)
      .map((item): OrganizationType | null => {
        const record = item as Record<string, unknown>;
        const id = String(record._id ?? record.id ?? '').trim();
        const label = String(record.organizationType ?? record.name ?? '').trim();
        if (!id || !label) return null;
        return {
          _id: id,
          id,
          name: String(record.name ?? label),
          organizationType: label,
          category: typeof record.category === 'string' ? record.category : undefined,
        };
      })
      .filter((item): item is OrganizationType => item !== null);
  },

  addInterests: (interests: string[]) => api.patch('user/add-interests', { interests }),
  addFollowing: (following: string[]) => api.patch('user/add-following', { following }),
  updateProfile: (body: Record<string, unknown> | FormData) => api.patch<ApiUser>('user/update-profile', body),

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

  createPost: (
    content: string,
    extra?: {
      gif?: unknown;
      location?: unknown;
      turnstileToken?: string;
      scriptureShare?: {
        book: string;
        chapter: number;
        verse: number;
        verseEnd?: number;
        translation?: string;
      };
    }
  ) => api.post('social/post', { content, ...extra }),

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
    turnstileToken?: string;
    scriptureShare?: {
      book: string;
      chapter: number;
      verse: number;
      verseEnd?: number;
      translation?: string;
    };
  }) => {
    const form = new FormData();
    form.append('content', params.content);
    if (params.mentionedUserIds) {
      params.mentionedUserIds.forEach((id) => form.append('mentionedUserIds[]', id));
    }
    if (params.gif) form.append('gif', JSON.stringify(params.gif));
    if (params.location) form.append('location', JSON.stringify(params.location));
    if (params.turnstileToken) form.append('turnstileToken', params.turnstileToken);
    if (params.scriptureShare) form.append('scriptureShare', JSON.stringify(params.scriptureShare));
    params.images.forEach((file) => form.append('images', file, file.name));
    return api.post<{ postId?: string; _id?: string; id?: string; pendingReview?: boolean }>(
      'social/post',
      form
    );
  },

  /* --- Comments (GET list / POST add / reply) --- */
  async getComments(
    postId: string,
    type: CommentContentType = 'social',
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
    type: CommentContentType = 'social',
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
    type: CommentContentType = 'social',
    parentCommentId?: string,
  ) =>
    api
      .post<ApiComment>(
        `comments/${type}/${postId}`,
        parentCommentId ? { content, parentCommentId, replyToCommentId: parentCommentId } : { content },
      )
      .then((c) => mapComment(c)),

  /* --- Per-comment interactions (like / bookmark) --- */
  reactToComment: ({
    postId,
    commentId,
    type = 'social',
    reactionType = 'love',
  }: {
    postId: string;
    commentId: string;
    type?: CommentContentType;
    reactionType?: FullReactionKind;
  }) =>
    api.patch(`comments/${type}/${postId}/${commentId}/reaction`, {
      type: getApiReactionType(reactionType),
    }),
  removeCommentReaction: (postId: string, commentId: string, type: CommentContentType = 'social') =>
    api.del(`comments/${type}/${postId}/${commentId}/reaction`),
  bookmarkComment: (postId: string, commentId: string, type: CommentContentType = 'social') =>
    api.patch(`comments/${type}/${postId}/${commentId}/bookmark`),
  unbookmarkComment: (postId: string, commentId: string, type: CommentContentType = 'social') =>
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

  getMyProfile: (signal?: AbortSignal) =>
    api.get<ApiUser>('user/my-profile', { pullSavedData: false }, signal),

  async getMyProfileMapped(signal?: AbortSignal): Promise<MyProfile> {
    const u = await api.get<ApiUser>('user/my-profile', { pullSavedData: false }, signal);
    return mapMyProfile(u);
  },

  async getUserPosts(userId: string, page = 1, myUserId?: string): Promise<OBPost[]> {
    const payload = await api.get(`user/get-social/onebody/${userId}/${page}`, { itemsPerPage: 12 });
    return unwrapList(payload).map((p) => mapPost(p as ApiSocialPost, myUserId));
  },

  async getFollowingUsers(): Promise<OBUser[]> {
    const payload = await api.get('user/get-following');
    return unwrapList(payload).map((u) => mapUser(u as ApiUser));
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

  async getSuggestedUsers(
    interestIds: string[] = [],
    page = 1,
    itemsPerPage = 24,
  ): Promise<OBUser[]> {
    const interests = interestIds
      .map((id) => id.trim())
      .filter(Boolean)
      .join(',');
    const payload = await api.get(`user/get-users-to-subscribe/${page}`, {
      itemsPerPage,
      interests: interests || undefined,
    });
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

  async getNotifications(): Promise<InboxNotification[]> {
    const payload = await api.get<{ data?: unknown[] }>('user/notifications');
    return unwrapList(payload)
      .map((n) => mapNotification(n as Record<string, unknown>))
      .filter((n): n is InboxNotification => n !== null);
  },
  markNotificationRead: (id: string) => api.patch(`user/notifications/${id}/read`, {}),
  deleteNotification: (id: string) => api.del(`user/notifications/${id}`),
  markAllNotificationsRead: () => api.patch('user/notifications/read-all'),

  async getNotificationSettings(signal?: AbortSignal): Promise<NotificationSettings> {
    const user = await api.get<Record<string, unknown>>(
      'user/my-profile',
      { pullSavedData: false },
      signal,
    );
    const bool = (value: unknown, fallback: boolean) =>
      typeof value === 'boolean' ? value : fallback;
    return {
      pushNotificationsEnabled: bool(user.pushNotificationsEnabled, true),
      connectionNotificationsEnabled: bool(user.connectionNotificationsEnabled, true),
      tagNotificationsEnabled: bool(user.tagNotificationsEnabled, true),
      emailNotificationsEnabled: bool(user.emailNotificationsEnabled, true),
      allowDirectMessages: bool(user.allowDirectMessages, true),
      subscribedToNewsletter: bool(user.subscribedToNewsletter, false),
    };
  },
  updateNotificationSettings: (partial: Partial<NotificationSettings>) =>
    api.patch('user/set-notifications', partial),

  /** IDs of followed users who are approved creators — drives the "Creators" section. */
  async getFollowingApprovedCreatorIds(): Promise<string[]> {
    const payload = await api.get('user/get-following');
    const toRecord = (value: unknown): Record<string, unknown> =>
      value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const ids = unwrapList(payload).reduce<string[]>((acc, raw) => {
      const entry = toRecord(raw);
      const id = String(entry._id ?? entry.id ?? '').trim();
      if (!id) return acc;
      const influencerStatus = String(
        toRecord(entry.influencerProfile).influencerStatus ??
          entry.influencerStatus ??
          entry.status ??
          '',
      ).toLowerCase();
      const approved =
        influencerStatus === 'approved' ||
        entry.isApprovedInfluencer === true ||
        toRecord(entry.userData).isApprovedInfluencer === true;
      if (approved) acc.push(id);
      return acc;
    }, []);
    return Array.from(new Set(ids));
  },

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
const NOTIFICATION_KINDS: NotificationKind[] = ['reaction', 'comment', 'follow', 'prayer', 'mention'];

function notifString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function notifHttpUrl(value: unknown): string | undefined {
  const v = notifString(value);
  return v && /^https?:\/\//i.test(v) ? v : undefined;
}

// Mirrors the mobile `toServerNotification` extraction so web and mobile read the same fields.
function mapNotification(n: Record<string, unknown>): InboxNotification | null {
  const sourceId = String(n._id ?? n.id ?? '').trim();
  if (!sourceId) return null;
  const data = (n.data && typeof n.data === 'object' ? n.data : {}) as Record<string, unknown>;
  const kindRaw = String(n.type ?? n.kind ?? 'reaction').toLowerCase();
  const kind: NotificationKind = NOTIFICATION_KINDS.includes(kindRaw as NotificationKind)
    ? (kindRaw as NotificationKind)
    : 'reaction';
  return {
    id: `server:${sourceId}`,
    sourceId,
    title: String(n.title ?? 'Notification'),
    body: String(n.description ?? n.message ?? n.body ?? ''),
    createdAt: String(n.createdAt ?? ''),
    read: n.read === true || n.isRead === true,
    url: notifString(n.url) ?? notifString(data.url) ?? notifString(data.deepLink) ?? notifString(data.link),
    iconUrl: notifHttpUrl(n.iconUrl ?? n.notificationIconUrl ?? n.icon ?? n.imageUrl ?? n.image),
    campaignId: notifString(n.campaignId),
    notificationType: notifString(n.type) ?? notifString(data.type),
    notificationSource: notifString(n.source) ?? notifString(data.source),
    actorId: notifString(data.actorId),
    kind,
    data,
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
