import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Loader2, MessageCircle, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { HlsVideo } from './HlsVideo';
import { watchApi, type WatchVideo } from '@/api/watch';
import { trackFeedEvent } from '@/telemetry/feedTelemetry';
import './WatchLightbox.css';

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

/** Full-size theater player. 16:9 plays wide; 9:16 plays tall (portrait). */
export function WatchLightbox({ video, onClose }: { video: WatchVideo; onClose: () => void }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.reactions);
  const portrait = video.aspectRatio < 1;

  useEffect(() => {
    let cancelled = false;
    watchApi
      .playback(video.playbackId)
      .then((pb) => !cancelled && setMediaUrl(pb.mediaUrl))
      .catch(() => !cancelled && setMediaUrl(`https://stream.mux.com/${video.playbackId}.m3u8`));

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [video.playbackId, onClose]);

  function track(eventType: string, canonicalEventName: string, metadata?: Record<string, unknown>) {
    trackFeedEvent({
      feedType: 'watch',
      postId: video.id,
      postType: 'watch',
      contentType: 'watch',
      surfaceTab: 'watch',
      eventType,
      canonicalEventName,
      metadata,
    });
  }

  function like() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    watchApi.react(video.id, 'love').catch(() => {});
    track(next ? 'reaction' : 'reaction_removed', next ? 'post_reaction_add' : 'post_reaction_remove', {
      reactionType: 'love',
    });
  }

  return (
    <dialog className="watch-lightbox" aria-label={video.title || 'Video'} open>
      <button
        type="button"
        className="watch-lightbox__backdrop"
        onClick={onClose}
        aria-label="Close video"
      />
      <button type="button" className="watch-lightbox__close" onClick={onClose} aria-label="Close">
        <X size={22} />
      </button>
      <motion.div
        className={`watch-lightbox__theater${portrait ? ' is-portrait' : ''}`}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="watch-lightbox__frame" style={{ aspectRatio: String(video.aspectRatio || 16 / 9) }}>
          {mediaUrl ? (
            <HlsVideo
              src={mediaUrl}
              poster={video.thumbnail}
              className="watch-lightbox__video"
              controls
              autoPlay
              onVideoEvent={(eventType, canonicalEventName, metadata) =>
                track(eventType, canonicalEventName, metadata)
              }
            />
          ) : (
            <div className="watch-lightbox__loading">
              <Loader2 size={30} className="spin" />
            </div>
          )}
        </div>

        <div className="watch-lightbox__meta">
          <div className="watch-lightbox__head">
            <Avatar src={video.authorAvatar} alt={video.authorName} size={42} />
            <div className="watch-lightbox__id">
              <strong>{video.title || video.authorName}</strong>
              <span>
                {video.authorName} · {video.time}
              </span>
            </div>
          </div>
          {video.caption ? <p className="watch-lightbox__cap">{video.caption}</p> : null}
          <div className="watch-lightbox__actions">
            <button
              type="button"
              className={`watch-lightbox__like${liked ? ' is-active' : ''}`}
              onClick={like}
            >
              <Heart size={19} fill={liked ? 'currentColor' : 'none'} /> {formatCount(likeCount)}
            </button>
            <span className="watch-lightbox__stat">
              <MessageCircle size={19} /> {formatCount(video.comments)}
            </span>
          </div>
        </div>
      </motion.div>
    </dialog>
  );
}
