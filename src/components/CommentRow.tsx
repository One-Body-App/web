import { useState, type MouseEvent } from 'react';
import { Bookmark, Heart, MoreHorizontal, Repeat2, Send } from 'lucide-react';
import { Avatar } from './Avatar';
import { endpoints, type OBComment } from '@/api/endpoints';

const SHARE_BASE = 'https://app.onebodyapp.com';

export type CommentTrack = (
  eventType: string,
  canonicalEventName: string,
  metadata?: Record<string, unknown>,
) => void;
export type CommentPatch = Partial<
  Pick<OBComment, 'liked' | 'reactions' | 'bookmarked' | 'reposts' | 'replies'>
>;

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

// X's reply glyph is a chat bubble, not lucide's "reply" arrow.
function ReplyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/**
 * One reply row, X-style: avatar · (name @handle · time / body / actions).
 * `variant="row"` is tappable to drill into that comment's thread;
 * `variant="anchor"` is the focused comment pinned at the top of a thread.
 */
export function CommentRow({
  comment,
  postId,
  variant,
  onOpen,
  onReplyFocus,
  onMutate,
  onTrack,
}: {
  comment: OBComment;
  postId: string;
  variant: 'row' | 'anchor';
  onOpen?: (c: OBComment) => void;
  onReplyFocus?: () => void;
  onMutate?: (id: string, patch: CommentPatch) => void;
  onTrack?: CommentTrack;
}) {
  const [liked, setLiked] = useState(comment.liked);
  const [reactions, setReactions] = useState(comment.reactions);
  const [bookmarked, setBookmarked] = useState(comment.bookmarked);
  const [reposts, setReposts] = useState(comment.reposts);
  const [copied, setCopied] = useState(false);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  function toggleLike(e: MouseEvent) {
    stop(e);
    const next = !liked;
    const nextReactions = Math.max(0, reactions + (next ? 1 : -1));
    setLiked(next);
    setReactions(nextReactions);
    onMutate?.(comment.id, { liked: next, reactions: nextReactions });
    onTrack?.(
      next ? 'comment_like' : 'comment_unlike',
      next ? 'post_comment_reaction_add' : 'post_comment_reaction_remove',
      { commentId: comment.id },
    );
    const req = next
      ? endpoints.reactToComment(postId, comment.id)
      : endpoints.removeCommentReaction(postId, comment.id);
    req.catch(() => {
      setLiked(!next);
      setReactions(reactions);
      onMutate?.(comment.id, { liked: !next, reactions });
    });
  }

  function toggleBookmark(e: MouseEvent) {
    stop(e);
    const next = !bookmarked;
    setBookmarked(next);
    onMutate?.(comment.id, { bookmarked: next });
    const req = next
      ? endpoints.bookmarkComment(postId, comment.id)
      : endpoints.unbookmarkComment(postId, comment.id);
    req.catch(() => {
      setBookmarked(!next);
      onMutate?.(comment.id, { bookmarked: !next });
    });
  }

  function doRepost(e: MouseEvent) {
    stop(e);
    const next = reposts + 1;
    setReposts(next);
    onMutate?.(comment.id, { reposts: next });
    onTrack?.('comment_repost', 'post_repost', { sourceType: 'comment', commentId: comment.id });
    endpoints.repost(comment.id, 'comment').catch(() => {
      setReposts(reposts);
      onMutate?.(comment.id, { reposts });
    });
  }

  function onReply(e: MouseEvent) {
    stop(e);
    if (variant === 'anchor') onReplyFocus?.();
    else onOpen?.(comment);
  }

  async function share(e: MouseEvent) {
    stop(e);
    const url = `${SHARE_BASE}/post/social/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${comment.author.name} on One Body`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* dismissed / clipboard blocked — no-op */
    }
  }

  const clickable = variant === 'row';
  return (
    <article
      className={`cmt cmt--${variant}`}
      onClick={clickable ? () => onOpen?.(comment) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <Avatar
        src={comment.author.avatar}
        alt={comment.author.name}
        size={variant === 'anchor' ? 44 : 40}
        verified={comment.author.verified}
      />
      <div className="cmt__main">
        <div className="cmt__head">
          <span className="cmt__name">{comment.author.name}</span>
          <span className="cmt__handle">@{comment.author.username}</span>
          <span className="cmt__sep">·</span>
          <span className="cmt__time">{comment.createdAt}</span>
          <button type="button" className="cmt__more" onClick={stop} aria-label="More options">
            <MoreHorizontal size={16} />
          </button>
        </div>
        <p className="cmt__body">{comment.body}</p>
        <div className="cmt__actions">
          <button type="button" className="cmt__action" onClick={onReply} aria-label="Reply">
            <ReplyIcon />
            {comment.replies > 0 ? <span>{formatCount(comment.replies)}</span> : null}
          </button>
          <button
            type="button"
            className="cmt__action cmt__action--repost"
            onClick={doRepost}
            aria-label="Repost"
          >
            <Repeat2 size={17} />
            {reposts > 0 ? <span>{formatCount(reposts)}</span> : null}
          </button>
          <button
            type="button"
            className={`cmt__action cmt__action--like${liked ? ' is-active' : ''}`}
            onClick={toggleLike}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            {reactions > 0 ? <span>{formatCount(reactions)}</span> : null}
          </button>
          <button
            type="button"
            className={`cmt__action cmt__action--bookmark${bookmarked ? ' is-active' : ''}`}
            onClick={toggleBookmark}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="cmt__action cmt__action--share"
            onClick={share}
            aria-label="Share"
          >
            <Send size={16} />
            {copied ? <span className="cmt__copied">Copied</span> : null}
          </button>
        </div>
      </div>
    </article>
  );
}
