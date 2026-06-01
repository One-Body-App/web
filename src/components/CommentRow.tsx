import { useState, type MouseEvent } from 'react';
import { Bookmark, MoreHorizontal, Repeat2, Send } from 'lucide-react';
import { Avatar } from './Avatar';
import { ReactionRail } from './ReactionRail';
import { endpoints, type CommentContentType, type OBComment } from '@/api/endpoints';
import {
  createReactionCounts,
  getReactionTotal,
  patchReactionCounts,
  type FullReactionKind,
  type ReactionCounts,
} from '@/api/reactions';

const SHARE_BASE = 'https://app.onebodyapp.com';

export type CommentTrack = (
  eventType: string,
  canonicalEventName: string,
  metadata?: Record<string, unknown>,
) => void;
export type CommentPatch = Partial<
  Pick<OBComment, 'liked' | 'reactions' | 'reactionCounts' | 'myReaction' | 'bookmarked' | 'reposts' | 'replies'>
>;

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function stopPropagation(e: MouseEvent) {
  e.stopPropagation();
}

// X's reply glyph is a chat bubble, not lucide's "reply" arrow.
function ReplyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  type = 'social',
  variant,
  onOpen,
  onReplyFocus,
  onMutate,
  onTrack,
}: {
  comment: OBComment;
  postId: string;
  type?: CommentContentType;
  variant: 'row' | 'anchor';
  onOpen?: (c: OBComment) => void;
  onReplyFocus?: () => void;
  onMutate?: (id: string, patch: CommentPatch) => void;
  onTrack?: CommentTrack;
}) {
  const [reactionOverride, setReactionOverride] = useState<{
    commentId: string;
    myReaction: FullReactionKind | null;
    reactionCounts: ReactionCounts;
  } | null>(null);
  const [bookmarkOverride, setBookmarkOverride] = useState<{ commentId: string; bookmarked: boolean } | null>(
    null,
  );
  const [repostOverride, setRepostOverride] = useState<{ commentId: string; reposts: number } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const reactionState =
    reactionOverride?.commentId === comment.id
      ? reactionOverride
      : {
          commentId: comment.id,
          myReaction: comment.myReaction,
          reactionCounts: comment.reactionCounts ?? createReactionCounts(),
        };
  const { myReaction, reactionCounts } = reactionState;
  const bookmarked =
    bookmarkOverride?.commentId === comment.id ? bookmarkOverride.bookmarked : comment.bookmarked;
  const reposts = repostOverride?.commentId === comment.id ? repostOverride.reposts : comment.reposts;
  const reactions = getReactionTotal(reactionCounts);
  const showShare = type !== 'prayer';

  function react(kind: FullReactionKind) {
    const wasActive = myReaction === kind;
    const previousCounts = reactionCounts;
    const previousReaction = myReaction;
    const nextReaction = wasActive ? null : kind;
    const nextCounts = patchReactionCounts(reactionCounts, previousReaction, nextReaction);
    const nextTotal = getReactionTotal(nextCounts);
    setReactionOverride({
      commentId: comment.id,
      myReaction: nextReaction,
      reactionCounts: nextCounts,
    });
    onMutate?.(comment.id, {
      liked: Boolean(nextReaction),
      myReaction: nextReaction,
      reactionCounts: nextCounts,
      reactions: nextTotal,
    });
    onTrack?.(
      nextReaction ? 'comment_like' : 'comment_unlike',
      nextReaction ? 'post_comment_reaction_add' : 'post_comment_reaction_remove',
      { commentId: comment.id, reactionType: kind, postType: type },
    );
    const req = nextReaction
      ? endpoints.reactToComment({ postId, commentId: comment.id, type, reactionType: kind })
      : endpoints.removeCommentReaction(postId, comment.id, type);
    req.catch(() => {
      setReactionOverride({
        commentId: comment.id,
        myReaction: previousReaction,
        reactionCounts: previousCounts,
      });
      onMutate?.(comment.id, {
        liked: Boolean(previousReaction),
        myReaction: previousReaction,
        reactionCounts: previousCounts,
        reactions: getReactionTotal(previousCounts),
      });
    });
  }

  function toggleDefaultReaction() {
    react(myReaction ?? 'love');
  }

  function toggleBookmark(e: MouseEvent) {
    stopPropagation(e);
    const next = !bookmarked;
    setBookmarkOverride({ commentId: comment.id, bookmarked: next });
    onMutate?.(comment.id, { bookmarked: next });
    const req = next
      ? endpoints.bookmarkComment(postId, comment.id, type)
      : endpoints.unbookmarkComment(postId, comment.id, type);
    req.catch(() => {
      setBookmarkOverride({ commentId: comment.id, bookmarked: !next });
      onMutate?.(comment.id, { bookmarked: !next });
    });
  }

  function doRepost(e: MouseEvent) {
    stopPropagation(e);
    const next = reposts + 1;
    setRepostOverride({ commentId: comment.id, reposts: next });
    onMutate?.(comment.id, { reposts: next });
    onTrack?.('comment_repost', 'post_repost', { sourceType: 'comment', commentId: comment.id });
    endpoints.repost(comment.id, 'comment').catch(() => {
      setRepostOverride({ commentId: comment.id, reposts });
      onMutate?.(comment.id, { reposts });
    });
  }

  function onReply(e: MouseEvent) {
    stopPropagation(e);
    if (variant === 'anchor') onReplyFocus?.();
    else onOpen?.(comment);
  }

  async function share(e: MouseEvent) {
    stopPropagation(e);
    const url = `${SHARE_BASE}/post/${type}/${postId}`;
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
          <button type="button" className="cmt__more" onClick={stopPropagation} aria-label="More options">
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
          <ReactionRail
            activeReaction={myReaction}
            total={reactions}
            onToggleDefault={toggleDefaultReaction}
            onSelect={react}
            compact
            ariaLabel="React to comment"
          />
          <button
            type="button"
            className={`cmt__action cmt__action--bookmark${bookmarked ? ' is-active' : ''}`}
            onClick={toggleBookmark}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
          {showShare ? (
            <button
              type="button"
              className="cmt__action cmt__action--share"
              onClick={share}
              aria-label="Share"
            >
              <Send size={16} />
              {copied ? <span className="cmt__copied">Copied</span> : null}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
