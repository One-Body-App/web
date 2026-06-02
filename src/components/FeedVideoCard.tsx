import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Play } from 'lucide-react';
import { Avatar } from './Avatar';
import type { WatchVideo } from '@/api/watch';
import { useFeedTelemetry } from '@/telemetry/feedTelemetry';
import './FeedVideoCard.css';

// Defer the player (and hls.js, ~400KB) until a video is actually opened.
const WatchLightbox = lazy(() => import('./WatchLightbox').then((m) => ({ default: m.WatchLightbox })));

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function fmtDur(ms?: number) {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * A Watch video as it appears inline in the Home feed (opens the theater player).
 * When `to` is provided, tapping the frame navigates there instead of opening the
 * player (used on Explore, where video cards link to the Watch page).
 */
export function FeedVideoCard({ video, to }: { video: WatchVideo; to?: string }) {
  const [open, setOpen] = useState(false);
  const track = useFeedTelemetry();
  const navigate = useNavigate();
  const portrait = video.aspectRatio < 1;

  function play() {
    track('open_video', 'post_comment_open', { postType: 'watch' });
    setOpen(true);
  }

  return (
    <motion.article
      className="fvideo card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        className={`fvideo__frame${portrait ? ' is-portrait' : ''}`}
        style={{ aspectRatio: String(video.aspectRatio || 16 / 9) }}
        onClick={to ? () => navigate(to) : play}
        aria-label={to ? `Open ${video.title || 'video'} on Watch` : `Play ${video.title || 'video'}`}
      >
        <img src={video.thumbnail} alt="" loading="lazy" />
        <span className="fvideo__play">
          <Play size={26} fill="currentColor" />
        </span>
        <span className="fvideo__badge">{portrait ? 'Short' : 'Video'}</span>
        {video.durationMs ? <span className="fvideo__dur">{fmtDur(video.durationMs)}</span> : null}
      </button>

      <div className="fvideo__meta">
        <Avatar src={video.authorAvatar} alt={video.authorName} size={40} verified={false} />
        <div className="fvideo__info">
          <strong>{video.title || video.authorName}</strong>
          {video.caption ? <p>{video.caption}</p> : null}
          <span className="fvideo__by">
            {video.authorName} · {video.time}
          </span>
        </div>
      </div>

      <div className="fvideo__actions">
        <span className="fvideo__stat">
          <Heart size={18} /> {formatCount(video.reactions)}
        </span>
        <span className="fvideo__stat">
          <MessageCircle size={18} /> {formatCount(video.comments)}
        </span>
      </div>

      <AnimatePresence>
        {open ? (
          <Suspense fallback={null}>
            <WatchLightbox video={video} onClose={() => setOpen(false)} />
          </Suspense>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
