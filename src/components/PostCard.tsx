import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, MessageCircle, MoreHorizontal, Repeat2, Share } from 'lucide-react';
import { Avatar } from './Avatar';
import { REACTIONS, type OBPost, type ReactionKind } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
import { useFeedTelemetry } from '@/telemetry/feedTelemetry';
import './PostCard.css';

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

export function PostCard({ post }: { post: OBPost }) {
  const [myReaction, setMyReaction] = useState<ReactionKind | null>(post.myReaction ?? null);
  const [counts, setCounts] = useState(post.reactions);
  const [saved, setSaved] = useState(Boolean(post.saved));
  const [pickerOpen, setPickerOpen] = useState(false);
  const track = useFeedTelemetry();

  const totalReactions = counts.love + counts.pray + counts.rejoice;

  function react(kind: ReactionKind) {
    const wasActive = myReaction === kind;
    setCounts((prev) => {
      const next = { ...prev };
      if (myReaction) next[myReaction] -= 1;
      if (myReaction !== kind) next[kind] += 1;
      return next;
    });
    setMyReaction((prev) => (prev === kind ? null : kind));
    setPickerOpen(false);
    // Persist (optimistic): best-effort, ignore failures (e.g. offline/CORS).
    const request = wasActive ? endpoints.removeReaction(post.id) : endpoints.reactToPost(post.id, kind);
    request.catch(() => {});
    track(
      wasActive ? 'reaction_removed' : 'reaction',
      wasActive ? 'post_reaction_remove' : 'post_reaction_add',
      { reactionType: kind },
    );
  }

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    track(next ? 'save' : 'unsave', next ? 'post_save_add' : 'post_save_remove');
  }

  const active = REACTIONS.find((r) => r.kind === myReaction);

  return (
    <motion.article
      className="post card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="post__head">
        <Avatar src={post.author.avatar} alt={post.author.name} size={46} verified={post.author.verified} />
        <div className="post__id">
          <span className="post__name">{post.author.name}</span>
          <span className="post__meta">
            @{post.author.username} · {post.createdAt}
          </span>
        </div>
        <button className="post__more" aria-label="More options">
          <MoreHorizontal size={20} />
        </button>
      </header>

      {post.body ? <p className="post__body">{post.body}</p> : null}

      {post.verse ? (
        <blockquote className="post__verse">
          <span className="post__verse-mark">“</span>
          <p>{post.verse.text}</p>
          <cite>{post.verse.ref}</cite>
        </blockquote>
      ) : null}

      {post.image ? (
        <div className="post__media">
          <img src={post.image} alt="" loading="lazy" />
        </div>
      ) : null}

      {totalReactions > 0 ? (
        <div className="post__react-summary">
          <span className="post__react-emojis" aria-hidden>
            {REACTIONS.filter((r) => counts[r.kind] > 0)
              .slice(0, 3)
              .map((r) => (
                <span key={r.kind}>{r.emoji}</span>
              ))}
          </span>
          <span>{formatCount(totalReactions)}</span>
        </div>
      ) : null}

      <footer className="post__actions">
        <div className="post__react-wrap">
          <button
            className={`post__action${myReaction ? ' is-active' : ''}`}
            style={active ? { color: active.color } : undefined}
            onClick={() => (myReaction ? react(myReaction) : setPickerOpen((o) => !o))}
            onMouseEnter={() => setPickerOpen(true)}
          >
            <span className="post__action-emoji">{active ? active.emoji : '🤍'}</span>
            {active ? active.label : 'React'}
          </button>

          <AnimatePresence>
            {pickerOpen ? (
              <motion.div
                className="post__picker glass"
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                onMouseLeave={() => setPickerOpen(false)}
              >
                {REACTIONS.map((r) => (
                  <button
                    key={r.kind}
                    className="post__picker-btn"
                    onClick={() => react(r.kind)}
                    title={r.label}
                  >
                    <span>{r.emoji}</span>
                    <small>{r.label}</small>
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <button
          className="post__action"
          onClick={() => track('open_comments', 'post_comment_open')}
        >
          <MessageCircle size={20} />
          {formatCount(post.comments)}
        </button>
        <button className="post__action">
          <Repeat2 size={21} />
          {formatCount(post.reposts)}
        </button>
        <button
          className={`post__action post__action--save${saved ? ' is-active' : ''}`}
          onClick={toggleSave}
          aria-label="Save"
        >
          <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button
          className="post__action post__action--share"
          aria-label="Share"
          onClick={() => track('share_initiated', 'post_share_initiated')}
        >
          <Share size={19} />
        </button>
      </footer>
    </motion.article>
  );
}
