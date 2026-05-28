import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, PenLine, Repeat2, Send } from 'lucide-react';
import { Avatar } from './Avatar';
import { REACTIONS, type OBPost, type ReactionKind } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
import { useFeedTelemetry } from '@/telemetry/feedTelemetry';
import './PostCard.css';

const SHARE_BASE = 'https://app.onebodyapp.com';

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

interface PostCardProps {
  post: OBPost;
  /** Rendered as the focused item on the Post detail page (flat, not a card). */
  detail?: boolean;
  /** In detail mode, the comment button calls this (focus composer) instead of navigating. */
  onCommentClick?: () => void;
}

export function PostCard({ post, detail = false, onCommentClick }: PostCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [myReaction, setMyReaction] = useState<ReactionKind | null>(post.myReaction ?? null);
  const [counts, setCounts] = useState(post.reactions);
  const [saved, setSaved] = useState(Boolean(post.saved));
  const [repostCount, setRepostCount] = useState(post.reposts);
  const [reposted, setReposted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const track = useFeedTelemetry();

  const totalReactions = counts.love + counts.pray + counts.rejoice;
  const active = REACTIONS.find((r) => r.kind === myReaction);

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
    track(next ? 'save' : 'unsave', next ? 'post_save_add' : 'post_save_remove', { postType: 'social' });
    const request = next
      ? endpoints.savePost({ postId: post.id, type: 'social', image: post.image, userId: post.author.id })
      : endpoints.unsavePost(post.id);
    request.catch(() => setSaved(!next)); // roll back if the write fails
  }

  function doRepost() {
    setRepostMenuOpen(false);
    setReposted(true);
    setRepostCount((c) => c + 1);
    track('repost', 'post_repost', { repostType: 'repost', sourceType: 'social' });
    endpoints.repost(post.id).catch(() => {
      setReposted(false);
      setRepostCount((c) => Math.max(0, c - 1));
    });
  }

  function quotePost() {
    setRepostMenuOpen(false);
    track('quote', 'post_quote_create', { repostType: 'quote', sourceType: 'social' });
    navigate('/post/new', {
      state: {
        backgroundLocation: location,
        quote: {
          sourceId: post.id,
          sourceType: 'social',
          author: post.author.name,
          username: post.author.username,
          avatar: post.author.avatar,
          verified: post.author.verified,
          body: post.body,
          image: post.image,
        },
      },
    });
  }

  /** Open the post's detail page (or, in detail mode, focus the reply box). */
  function openDetail() {
    if (detail) {
      onCommentClick?.();
      return;
    }
    track('open_comments', 'post_comment_open', { postType: 'social' });
    navigate(`/post/social/${post.id}`, { state: { post } });
  }

  async function sharePost() {
    const url = `${SHARE_BASE}/post/social/${post.id}`;
    track('share_initiated', 'post_share_initiated', { postType: 'social' });
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.author.name} on One Body`, text: post.body?.slice(0, 140), url });
        track('share_completed', 'post_share_completed', { result: 'success' });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
      track('share_completed', 'post_share_completed', { result: 'copied' });
    } catch {
      // User dismissed the share sheet, or clipboard was blocked.
      track('share_completed', 'post_share_completed', { result: 'cancel' });
    }
  }

  // In the feed, the body/media open the post; in detail mode they're inert.
  const openProps = detail ? {} : { onClick: openDetail, style: { cursor: 'pointer' } };

  return (
    <motion.article
      className={detail ? 'post post--detail' : 'post card'}
      initial={detail ? false : { opacity: 0, y: 14 }}
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
        <button type="button" className="post__more" aria-label="More options">
          <MoreHorizontal size={20} />
        </button>
      </header>

      {post.body ? (
        <p className="post__body" {...openProps}>
          {post.body}
        </p>
      ) : null}

      {post.verse ? (
        <blockquote className="post__verse">
          <span className="post__verse-mark">“</span>
          <p>{post.verse.text}</p>
          <cite>{post.verse.ref}</cite>
        </blockquote>
      ) : null}

      {post.image ? (
        <div className="post__media" {...openProps}>
          <img src={post.image} alt="" loading="lazy" />
        </div>
      ) : null}

      <footer className="post__actions">
        {/* React — tap to love / un-react; hover for the full picker. */}
        <div
          className="post__react-wrap"
          onMouseEnter={() => setPickerOpen(true)}
          onMouseLeave={() => setPickerOpen(false)}
        >
          <button
            type="button"
            className={`post__action${myReaction ? ' is-active' : ''}`}
            style={active ? { color: active.color } : undefined}
            onClick={() => react(myReaction ?? 'love')}
            aria-label={active ? active.label : 'React'}
          >
            {active ? (
              <span className="post__action-emoji">{active.emoji}</span>
            ) : (
              <Heart size={22} />
            )}
            {totalReactions > 0 ? (
              <span className="post__action-count">{formatCount(totalReactions)}</span>
            ) : null}
          </button>

          <AnimatePresence>
            {pickerOpen ? (
              <motion.div
                className="post__picker glass"
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.18 }}
              >
                {REACTIONS.map((r) => (
                  <button
                    type="button"
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

        {/* Comment — opens the post detail (feed) or focuses the composer (detail). */}
        <button type="button" className="post__action" onClick={openDetail} aria-label="Comments">
          <MessageCircle size={22} />
          {post.comments > 0 ? (
            <span className="post__action-count">{formatCount(post.comments)}</span>
          ) : null}
        </button>

        {/* Repost — menu with Repost / Quote (mobile parity) */}
        <div className="post__repost-wrap" onMouseLeave={() => setRepostMenuOpen(false)}>
          <button
            type="button"
            className={`post__action${reposted ? ' is-reposted' : ''}`}
            onClick={() => setRepostMenuOpen((o) => !o)}
            aria-label="Repost"
            aria-haspopup="menu"
            aria-expanded={repostMenuOpen ? 'true' : 'false'}
          >
            <Repeat2 size={22} />
            {repostCount > 0 ? (
              <span className="post__action-count">{formatCount(repostCount)}</span>
            ) : null}
          </button>

          <AnimatePresence>
            {repostMenuOpen ? (
              <motion.div
                className="post__repost-menu glass"
                role="menu"
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.16 }}
              >
                <button type="button" className="post__repost-item" role="menuitem" onClick={doRepost}>
                  <Repeat2 size={17} />
                  <span>Repost</span>
                </button>
                <button type="button" className="post__repost-item" role="menuitem" onClick={quotePost}>
                  <PenLine size={16} />
                  <span>Quote</span>
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Share */}
        <button
          type="button"
          className="post__action post__action--share"
          onClick={sharePost}
          aria-label="Share"
        >
          <Send size={21} />
          <AnimatePresence>
            {copied ? (
              <motion.span
                className="post__copied"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
              >
                Link copied
              </motion.span>
            ) : null}
          </AnimatePresence>
        </button>

        {/* Save */}
        <button
          type="button"
          className={`post__action post__action--save${saved ? ' is-active' : ''}`}
          onClick={toggleSave}
          aria-label={saved ? 'Saved' : 'Save'}
        >
          <Bookmark size={21} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </footer>
    </motion.article>
  );
}
