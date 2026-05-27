import { useState } from 'react';
import { Heart, Loader2, MessageCircle, Play, PlayCircle } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { HlsVideo } from '@/components/HlsVideo';
import { EmptyState, PageHeader } from '@/components/ui';
import { useApiQuery } from '@/api/useApi';
import { MOCK_VIDEOS, watchApi, type WatchVideo } from '@/api/watch';
import { trackFeedEvent } from '@/telemetry/feedTelemetry';
import './watch.css';

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function fmtDur(ms: number) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Watch() {
  const { data, loading } = useApiQuery(() => watchApi.feed(1), { fallback: MOCK_VIDEOS });
  const list = data ?? MOCK_VIDEOS;

  return (
    <div>
      <PageHeader title="Watch" subtitle="Short videos from across the Body." />

      {loading && !data ? (
        <WatchSkeleton />
      ) : list.length ? (
        <div className="watch-grid">
          {list.map((v) => (
            <WatchCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<PlayCircle size={30} />}
          title="No videos yet"
          body="Check back soon for new content from the Body."
        />
      )}
    </div>
  );
}

function WatchCard({ video }: { video: WatchVideo }) {
  const [playing, setPlaying] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.reactions);

  async function play() {
    setPlaying(true);
    if (!mediaUrl) {
      setLoadingUrl(true);
      const pb = await watchApi.playback(video.playbackId).catch(() => null);
      setMediaUrl(pb?.mediaUrl ?? `https://stream.mux.com/${video.playbackId}.m3u8`);
      setLoadingUrl(false);
    }
  }

  function like() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    watchApi.react(video.id, 'love').catch(() => {});
    trackFeedEvent({
      feedType: 'watch',
      postId: video.id,
      postType: 'watch',
      contentType: 'watch',
      surfaceTab: 'watch',
      eventType: next ? 'reaction' : 'reaction_removed',
      canonicalEventName: next ? 'post_reaction_add' : 'post_reaction_remove',
      metadata: { reactionType: 'love' },
    });
  }

  return (
    <article className="watch-card card">
      <div className="watch-card__frame" style={{ aspectRatio: String(video.aspectRatio || 9 / 16) }}>
        {playing && mediaUrl ? (
          <HlsVideo
            src={mediaUrl}
            poster={video.thumbnail}
            className="watch-card__video"
            controls
            autoPlay
            onVideoEvent={(eventType, canonicalEventName, metadata) =>
              trackFeedEvent({
                feedType: 'watch',
                postId: video.id,
                postType: 'watch',
                contentType: 'watch',
                surfaceTab: 'watch',
                eventType,
                canonicalEventName,
                metadata,
              })
            }
          />
        ) : (
          <button className="watch-card__poster" onClick={play} aria-label={`Play ${video.title || 'video'}`}>
            <img src={video.thumbnail} alt="" loading="lazy" />
            <span className="watch-card__play">
              {loadingUrl ? <Loader2 size={24} className="spin" /> : <Play size={24} fill="currentColor" />}
            </span>
            {video.durationMs ? <span className="watch-card__dur">{fmtDur(video.durationMs)}</span> : null}
          </button>
        )}
      </div>

      <div className="watch-card__meta">
        <Avatar src={video.authorAvatar} alt={video.authorName} size={34} />
        <div className="watch-card__info">
          <strong>{video.title || video.authorName}</strong>
          {video.caption ? <p>{video.caption}</p> : null}
          <span className="watch-card__by">
            {video.authorName} · {video.time}
          </span>
        </div>
      </div>

      <div className="watch-card__actions">
        <button className={`watch-card__like${liked ? ' is-active' : ''}`} onClick={like}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {formatCount(likeCount)}
        </button>
        <span className="watch-card__stat">
          <MessageCircle size={18} /> {formatCount(video.comments)}
        </span>
      </div>
    </article>
  );
}

function WatchSkeleton() {
  return (
    <div className="watch-grid">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--sp-16)' }}>
          <div className="skeleton" style={{ width: '100%', aspectRatio: '9 / 16' }} />
          <div style={{ padding: 'var(--sp-12)' }}>
            <div className="skeleton" style={{ width: '70%', height: 12 }} />
            <div className="skeleton" style={{ width: '40%', height: 10, marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
