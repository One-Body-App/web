import { api } from './client';

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

export interface WatchVideo {
  id: string;
  playbackId: string;
  title: string;
  caption: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  authorAvatar: string;
  aspectRatio: number; // width / height
  durationMs?: number;
  reactions: number;
  comments: number;
  time: string;
  thumbnail: string;
}

export interface WatchPlayback {
  mediaUrl: string;
  thumbnailUrl?: string;
}

type Raw = Record<string, unknown>;

function unwrap(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  if (payload && typeof payload === 'object') {
    const o = payload as Raw;
    for (const k of ['data', 'items', 'content', 'posts', 'videos']) {
      if (Array.isArray(o[k])) return o[k] as Raw[];
    }
  }
  return [];
}

/** Public Mux thumbnail (no signing required for the poster image). */
function muxThumb(playbackId: string, width = 640): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&fit_mode=preserve`;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function mapVideo(raw: Raw): WatchVideo | null {
  const playbackId = String(raw.playBackId ?? raw.playbackId ?? '');
  if (!playbackId) return null;
  const userData = (raw.userData ?? raw.user ?? {}) as Raw;
  const reactions = Array.isArray(raw.reactions)
    ? (raw.reactions as unknown[]).length
    : num(raw.reactionCount) ?? 0;
  const comments = Array.isArray(raw.comments)
    ? (raw.comments as unknown[]).length
    : num(raw.commentNumber) ?? 0;
  const w = num(raw.videoWidth);
  const h = num(raw.videoHeight);
  const aspectRatio = num(raw.aspectRatio) ?? (w && h ? w / h : 9 / 16);
  return {
    id: String(raw.postId ?? raw._id ?? raw.id ?? playbackId),
    playbackId,
    title: String(raw.title ?? '').trim(),
    caption: String(raw.content ?? '').trim(),
    authorId: String(userData._id ?? userData.id ?? ''),
    authorName: String(userData.name ?? userData.username ?? 'One Body member'),
    authorUsername: typeof userData.username === 'string' ? userData.username : undefined,
    authorAvatar: (typeof userData.profileImage === 'string' && userData.profileImage) || FALLBACK_AVATAR,
    aspectRatio,
    durationMs: num(raw.durationMs),
    reactions,
    comments,
    time: timeAgo(String(raw.created ?? raw.createdAt ?? raw.date ?? '')),
    thumbnail: muxThumb(playbackId),
  };
}

export const watchApi = {
  async feed(page = 1): Promise<WatchVideo[]> {
    const payload = await api.get(`user/get-following-feed/watch/${page}`);
    return unwrap(payload)
      .map(mapVideo)
      .filter((v): v is WatchVideo => v !== null);
  },

  /** Signed playback URL (mobile parity); falls back to the public stream URL. */
  async playback(playbackId: string): Promise<WatchPlayback> {
    try {
      const res = await api.get<{ data?: Partial<WatchPlayback> } & Partial<WatchPlayback>>(
        `watch/playback/${encodeURIComponent(playbackId)}`,
      );
      const d = (res?.data ?? res) as Partial<WatchPlayback> | undefined;
      if (d?.mediaUrl) return { mediaUrl: d.mediaUrl, thumbnailUrl: d.thumbnailUrl };
    } catch {
      /* fall through to the public stream URL */
    }
    return { mediaUrl: `https://stream.mux.com/${playbackId}.m3u8` };
  },

  react: (postId: string, kind: 'love' | 'pray' | 'rejoice') =>
    api.patch('watch/react', {
      postId,
      type: kind === 'love' ? 'love' : kind === 'pray' ? 'praying' : 'praise',
    }),
};

/** Shown when the live watch feed is unavailable (offline/CORS). */
export const MOCK_VIDEOS: WatchVideo[] = [
  {
    id: 'mv1',
    playbackId: '',
    title: 'Sunday worship moment',
    caption: '“Goodness of God” — live from the 11am service 🙌',
    authorId: 'u_maria',
    authorName: 'Maria Santos',
    authorUsername: 'mariasings',
    authorAvatar: '/brand/avatar2.png',
    aspectRatio: 9 / 16,
    reactions: 1284,
    comments: 96,
    time: '2h',
    thumbnail: 'https://picsum.photos/seed/ob-watch-1/600/1066',
  },
  {
    id: 'mv2',
    playbackId: '',
    title: '60-second devotional: Be still',
    caption: 'A quick word for your Monday. Psalm 46:10.',
    authorId: 'u_david',
    authorName: 'Pastor David Cole',
    authorUsername: 'pastordavid',
    authorAvatar: '/brand/avatar1.png',
    aspectRatio: 16 / 9,
    reactions: 902,
    comments: 54,
    time: '6h',
    thumbnail: 'https://picsum.photos/seed/ob-watch-2/900/506',
  },
  {
    id: 'mv3',
    playbackId: '',
    title: 'Serving downtown',
    caption: '240 meals served tonight. This is the Body in motion.',
    authorId: 'u_mercy',
    authorName: 'Mercy House',
    authorUsername: 'mercyhouse',
    authorAvatar: '/brand/avatar1.png',
    aspectRatio: 9 / 16,
    reactions: 760,
    comments: 42,
    time: '14h',
    thumbnail: 'https://picsum.photos/seed/ob-watch-3/600/1066',
  },
];
