import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Eye, Heart, MessageCircle, MoreHorizontal, PenLine, Repeat2, Send } from 'lucide-react';
import { Avatar } from './Avatar';
import { ScriptureText } from './scripture/ScriptureText';
import { REACTIONS, type OBPost, type OBPostRepost, type ReactionKind } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
import { useFeedTelemetry } from '@/telemetry/feedTelemetry';
import './PostCard.css';

const SHARE_BASE = 'https://app.onebodyapp.com';

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function sourceRoute(repost: OBPostRepost): string | null {
  if (repost.sourceType === 'comment') {
    const objectType = repost.sourceObjectType ?? 'social';
    const objectId = repost.sourceObjectId;
    const commentId = repost.sourceCommentId ?? repost.sourceId;
    return objectId && commentId ? `/post/${objectType}/${objectId}/c/${commentId}` : null;
  }
  const objectType = repost.sourceObjectType ?? repost.sourceType;
  const objectId = repost.sourceObjectId ?? repost.sourceId;
  if (!objectId) return null;
  return `/post/${objectType}/${objectId}`;
}

function sourceLabel(repost: OBPostRepost): string {
  const type = repost.sourceObjectType ?? repost.sourceType;
  if (type === 'prayer') return 'Prayer';
  if (type === 'rss') return 'Article';
  if (type === 'watch') return 'Watch';
  if (repost.sourceType === 'comment') return 'Comment';
  return 'Post';
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
  const [reactionOverride, setReactionOverride] = useState<{
    postId: string;
    myReaction: ReactionKind | null;
    counts: OBPost['reactions'];
  } | null>(null);
  const [saveOverride, setSaveOverride] = useState<{ postId: string; saved: boolean } | null>(null);
  const [repostOverride, setRepostOverride] = useState<{
    postId: string;
    count: number;
    reposted: boolean;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const track = useFeedTelemetry();

  const reactionState =
    reactionOverride?.postId === post.id
      ? reactionOverride
      : { postId: post.id, myReaction: post.myReaction ?? null, counts: post.reactions };
  const { myReaction, counts } = reactionState;
  const saved = saveOverride?.postId === post.id ? saveOverride.saved : Boolean(post.saved);
  const repostState =
    repostOverride?.postId === post.id
      ? repostOverride
      : { postId: post.id, count: post.reposts, reposted: false };
  const repostCount = repostState.count;
  const reposted = repostState.reposted;
  const totalReactions = counts.love + counts.pray + counts.rejoice;
  const active = REACTIONS.find((r) => r.kind === myReaction);
  const reactionClassName = active
    ? `post__action is-active post__action--reaction-${active.kind}`
    : 'post__action';

  function react(kind: ReactionKind) {
    const wasActive = myReaction === kind;
    const nextReaction = wasActive ? null : kind;
    const nextCounts = { ...counts };
    if (myReaction) nextCounts[myReaction] = Math.max(0, nextCounts[myReaction] - 1);
    if (nextReaction) nextCounts[nextReaction] += 1;
    setReactionOverride({ postId: post.id, myReaction: nextReaction, counts: nextCounts });
    setPickerOpen(false);
    const request = wasActive ? endpoints.removeReaction(post.id) : endpoints.reactToPost(post.id, kind);
    request.catch(() => setReactionOverride({ postId: post.id, myReaction, counts }));
    track(
      wasActive ? 'reaction_removed' : 'reaction',
      wasActive ? 'post_reaction_remove' : 'post_reaction_add',
      { reactionType: kind },
    );
  }

  function toggleSave() {
    const next = !saved;
    setSaveOverride({ postId: post.id, saved: next });
    track(next ? 'save' : 'unsave', next ? 'post_save_add' : 'post_save_remove', { postType: 'social' });
    const request = next
      ? endpoints.savePost({ postId: post.id, type: 'social', image: post.image, userId: post.author.id })
      : endpoints.unsavePost(post.id);
    request.catch(() => setSaveOverride({ postId: post.id, saved }));
  }

  function doRepost() {
    setRepostMenuOpen(false);
    setRepostOverride({ postId: post.id, count: repostCount + 1, reposted: true });
    track('repost', 'post_repost', { repostType: 'repost', sourceType: 'social' });
    endpoints.repost(post.id).catch(() => {
      setRepostOverride({ postId: post.id, count: repostCount, reposted: false });
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
  const mediaClassName = detail ? 'post__media' : 'post__media post__media--clickable';
  const openProps = detail ? {} : { onClick: openDetail };

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
        <ScriptureText
          className="post__body"
          text={post.body}
          mentions={post.scriptureMentions}
          onTextClick={detail ? undefined : openDetail}
        />
      ) : null}

      {post.verse ? (
        <blockquote className="post__verse">
          <span className="post__verse-mark">“</span>
          <p>{post.verse.text}</p>
          <cite>{post.verse.ref}</cite>
        </blockquote>
      ) : null}

      {post.scriptureShare ? <ScriptureShareCard share={post.scriptureShare} /> : null}

      {post.repost ? <RepostPreview repost={post.repost} onOpen={(path) => navigate(path)} /> : null}

      {post.image ? (
        <div className={mediaClassName} {...openProps}>
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
            className={reactionClassName}
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

        {/* Repost — popup with Repost / Quote (mobile parity) */}
        <div className="post__repost-wrap" onMouseLeave={() => setRepostMenuOpen(false)}>
          {repostMenuOpen ? (
            <button
              type="button"
              className={`post__action${reposted ? ' is-reposted' : ''}`}
              onClick={() => setRepostMenuOpen((o) => !o)}
              aria-label="Repost"
              aria-haspopup="true"
              aria-expanded="true"
            >
              <Repeat2 size={22} />
              {repostCount > 0 ? (
                <span className="post__action-count">{formatCount(repostCount)}</span>
              ) : null}
            </button>
          ) : (
            <button
              type="button"
              className={`post__action${reposted ? ' is-reposted' : ''}`}
              onClick={() => setRepostMenuOpen((o) => !o)}
              aria-label="Repost"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <Repeat2 size={22} />
              {repostCount > 0 ? (
                <span className="post__action-count">{formatCount(repostCount)}</span>
              ) : null}
            </button>
          )}

          <AnimatePresence>
            {repostMenuOpen ? (
              <motion.div
                className="post__repost-menu glass"
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.16 }}
              >
                <button type="button" className="post__repost-item" onClick={doRepost}>
                  <Repeat2 size={17} />
                  <span>Repost</span>
                </button>
                <button type="button" className="post__repost-item" onClick={quotePost}>
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

function ScriptureShareCard({ share }: { share: NonNullable<OBPost['scriptureShare']> }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = share.text.length > 220;
  const text = !isLong || expanded ? share.text : `${share.text.slice(0, 220).trimEnd()}...`;
  const count = Math.max(0, Number(share.shareCount ?? 0));

  return (
    <button
      type="button"
      className={`post__scripture-card${expanded ? ' is-expanded' : ''}`}
      onClick={() => setExpanded((value) => !value)}
      aria-expanded={expanded ? 'true' : 'false'}
    >
      <blockquote>
        <span className="post__verse-mark">“</span>
        <p>{text}</p>
        <cite>{share.reference}</cite>
      </blockquote>
      <span className="post__scripture-count">
        <Eye size={14} />
        {formatCount(count)} shares
      </span>
    </button>
  );
}

function RepostPreview({
  repost,
  onOpen,
}: {
  repost: OBPostRepost;
  onOpen: (path: string) => void;
}) {
  const route = sourceRoute(repost);
  const previewText =
    repost.sourceContentSnippet ||
    repost.sourceContent ||
    repost.sourceDescription ||
    repost.sourceTitle ||
    '';
  const previewImage = repost.sourceImage || repost.sourceImages?.[0];
  const label = sourceLabel(repost);
  const body = (
    <>
      <header className="post__source-head">
        <Avatar
          src={repost.sourceAuthorProfileImage || '/brand/avatar1.png'}
          alt={repost.sourceAuthorName || 'One Body member'}
          size={30}
        />
        <div className="post__source-id">
          <strong>{repost.sourceAuthorName || 'One Body member'}</strong>
          <span>
            {repost.sourceAuthorUsername ? `@${repost.sourceAuthorUsername}` : label}
            {repost.sourceCreatedAt ? ` · ${repost.sourceCreatedAt}` : ''}
          </span>
        </div>
        <span className="post__source-type">{label}</span>
      </header>
      {repost.sourceTitle ? <strong className="post__source-title">{repost.sourceTitle}</strong> : null}
      {previewText ? <p className="post__source-body">{previewText}</p> : null}
      {previewImage ? (
        <div className="post__source-media">
          <img src={previewImage} alt="" loading="lazy" />
        </div>
      ) : null}
    </>
  );

  if (!route) {
    return <aside className="post__source">{body}</aside>;
  }

  return (
    <button type="button" className="post__source post__source--button" onClick={() => onOpen(route)}>
      {body}
    </button>
  );
}
