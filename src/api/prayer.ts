import { api } from './client';
import {
  createReactionCounts,
  getApiReactionType,
  getReactionKindFromApi,
  type FullReactionKind,
  type ReactionCounts,
} from './reactions';

/* Mirrors api/src/modules/prayer (PrayerPost + PrayerWallCategory). */
export type PrayerCategory = 'request' | 'exhortation' | 'testimony' | 'answer' | 'myPrayers';
export type PrayerReaction = FullReactionKind;
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
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface Prayer {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  authorAvatar: string;
  isPrivate: boolean;
  content: string;
  category: PrayerCategory;
  answered: boolean;
  testimony?: string;
  reactions: ReactionCounts;
  myReaction: PrayerReaction | null;
  comments: number;
  reposts: number;
  time: string;
}

type Raw = Record<string, unknown>;

function unwrap(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  if (payload && typeof payload === 'object') {
    const o = payload as Raw;
    for (const k of ['data', 'items', 'content', 'posts', 'prayers']) {
      if (Array.isArray(o[k])) return o[k] as Raw[];
    }
  }
  return [];
}

function idFromValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Raw;
    const id = record._id ?? record.id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

export function mapPrayer(raw: Raw, myUserId?: string): Prayer {
  const userData = (raw.userData ?? raw.user ?? {}) as Raw;
  const reactionsArr = Array.isArray(raw.reactions) ? (raw.reactions as Raw[]) : [];
  const reactions = createReactionCounts();
  let myReaction: PrayerReaction | null = null;
  for (const r of reactionsArr) {
    const kind = typeof r.type === 'string' ? getReactionKindFromApi(r.type) : undefined;
    if (kind) {
      reactions[kind] += 1;
      if (myUserId && idFromValue(r.userId) === myUserId) myReaction = kind;
    }
  }
  const testimony = raw.testimony as Raw | undefined;
  const comments = Array.isArray(raw.comments)
    ? (raw.comments as unknown[]).length
    : typeof raw.commentNumber === 'number'
      ? raw.commentNumber
      : 0;
  return {
    id: String(raw.postId ?? raw._id ?? raw.id ?? Math.random().toString(36).slice(2)),
    authorId: String(userData._id ?? userData.id ?? ''),
    authorName: String(userData.name ?? userData.username ?? 'One Body member'),
    authorUsername: typeof userData.username === 'string' ? userData.username : undefined,
    authorAvatar: (typeof userData.profileImage === 'string' && userData.profileImage) || FALLBACK_AVATAR,
    isPrivate: Boolean(raw.private),
    content: String(raw.content ?? ''),
    category: (typeof raw.category === 'string' ? raw.category : 'request') as PrayerCategory,
    answered: Boolean(raw.answered),
    testimony: testimony && typeof testimony.content === 'string' ? testimony.content : undefined,
    reactions,
    myReaction,
    comments,
    reposts: typeof raw.repostCount === 'number' ? raw.repostCount : 0,
    time: timeAgo(String(raw.created ?? raw.createdAt ?? raw.date ?? '')),
  };
}

export const prayerApi = {
  async list(page = 1, myUserId?: string): Promise<Prayer[]> {
    const payload = await api.get('prayer', { page });
    return unwrap(payload).map((p) => mapPrayer(p, myUserId));
  },
  async get(id: string, myUserId?: string): Promise<Prayer | null> {
    const payload = await api.get<Raw>(`prayer/${id}`);
    const raw = (payload?.data ?? payload) as Raw | undefined;
    return raw ? mapPrayer(raw, myUserId) : null;
  },
  create: (body: {
    content: string;
    category: PrayerCategory;
    private: boolean;
    turnstileToken?: string;
  }) => api.post('prayer', body),
  react: (postId: string, kind: PrayerReaction) =>
    api.patch('prayer/react', { postId, type: getApiReactionType(kind) }),
  removeReaction: (postId: string) => api.patch('prayer/remove-reaction', { postId }),
  markAnswered: (id: string, testimony: string) =>
    api.patch(`prayer/answered/${id}`, { testimony, reactions: [] }),
  remove: (id: string) => api.del(`prayer/${id}`),
};

/** Shown when the live prayer feed is unavailable (offline/CORS). */
export const MOCK_PRAYERS: Prayer[] = [
  {
    id: 'mp1',
    authorId: 'u_aisha',
    authorName: 'Aisha Bello',
    authorUsername: 'aishab',
    authorAvatar: '/brand/avatar2.png',
    isPrivate: false,
    content: 'Please pray for my dad’s surgery tomorrow morning. Believing for a steady hand on the surgeon and complete healing. 🙏',
    category: 'request',
    answered: false,
    reactions: { ...createReactionCounts(), love: 24, pray: 188, praise: 6 },
    myReaction: 'pray',
    comments: 31,
    reposts: 8,
    time: '2h',
  },
  {
    id: 'mp2',
    authorId: '',
    authorName: 'Anonymous',
    authorAvatar: FALLBACK_AVATAR,
    isPrivate: true,
    content: 'Struggling with anxiety about a big decision. Praying for peace and clarity.',
    category: 'request',
    answered: false,
    reactions: { ...createReactionCounts(), love: 10, pray: 64, praise: 2 },
    myReaction: null,
    comments: 8,
    reposts: 0,
    time: '5h',
  },
  {
    id: 'mp3',
    authorId: 'u_david',
    authorName: 'Pastor David Cole',
    authorUsername: 'pastordavid',
    authorAvatar: FALLBACK_AVATAR,
    isPrivate: false,
    content: 'Asked for prayer last month about our building fund — praise God, it’s fully funded! 🎉',
    category: 'answer',
    answered: true,
    testimony: 'God moved through this community in a way we could never have planned. Thank you for praying with us.',
    reactions: { ...createReactionCounts(), love: 210, pray: 40, praise: 162 },
    myReaction: 'praise',
    comments: 47,
    reposts: 14,
    time: '1d',
  },
];
