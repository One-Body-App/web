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

/** Parse "16:9" / "1.78" / numbers (mirrors the app's resolveVideoMetadata). */
function parseAspect(raw: Raw): number | undefined {
  for (const c of [raw.aspect_ratio, raw.aspectRatio]) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return c;
    if (typeof c === 'string') {
      const s = c.trim();
      if (s.includes(':')) {
        const [w, h] = s.split(':').map(Number);
        if (w > 0 && h > 0) return w / h;
      }
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  const w = num(raw.videoWidth);
  const h = num(raw.videoHeight);
  return w && h ? w / h : undefined;
}

export function mapVideo(raw: Raw): WatchVideo | null {
  const playbackId = String(raw.playBackId ?? raw.playbackId ?? '');
  if (!playbackId) return null;
  const userData = (raw.userData ?? raw.user ?? {}) as Raw;
  const reactions = Array.isArray(raw.reactions)
    ? (raw.reactions as unknown[]).length
    : num(raw.reactionCount) ?? 0;
  const comments = Array.isArray(raw.comments)
    ? (raw.comments as unknown[]).length
    : num(raw.commentNumber) ?? num(raw.commentsCount) ?? 0;
  const aspectRatio = parseAspect(raw) ?? 9 / 16;
  const durationMs = num(raw.durationMs) ?? (num(raw.duration) ? num(raw.duration)! * 1000 : undefined);
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
    durationMs,
    reactions,
    comments,
    time: timeAgo(String(raw.created ?? raw.createdAt ?? raw.date ?? '')),
    thumbnail: muxThumb(playbackId),
  };
}

export const watchApi = {
  /** Watch portal = global discovery feed (all public videos, newest first). */
  async feed(page = 1): Promise<WatchVideo[]> {
    const payload = await api.get('watch', { itemsPerPage: 24, page });
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
