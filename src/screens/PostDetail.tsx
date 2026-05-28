import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PostCard } from '@/components/PostCard';
import { CommentRow, type CommentPatch } from '@/components/CommentRow';
import { endpoints, type OBComment, type SocialContentType } from '@/api/endpoints';
import type { OBPost } from '@/data/mock';
import { useAuth } from '@/auth/context';
import './PostDetail.css';

/**
 * X-style post/comment detail. The focused item (post, or a comment when
 * `:commentId` is present) is pinned at the top; its replies render as a flat
 * list below. Tapping a reply routes to that reply's page, so the browser back
 * button walks back up the thread to the original post.
 */
export function PostDetail() {
  const { type = 'social', id = '', commentId } = useParams();
  const objType = type as SocialContentType;
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState<OBPost | null>((location.state as { post?: OBPost } | null)?.post ?? null);
  const [focused, setFocused] = useState<OBComment | null>(null);
  const [items, setItems] = useState<OBComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load the focused level (post + top-level comments, or a comment + its replies).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setText('');
    window.scrollTo({ top: 0 });

    if (commentId) {
      endpoints
        .getCommentThread(id, commentId, objType)
        .then(({ root, replies }) => {
          if (cancelled) return;
          setFocused(root);
          setItems(replies);
        })
        .catch(() => !cancelled && (setFocused(null), setItems([])))
        .finally(() => !cancelled && setLoading(false));
    } else {
      setFocused(null);
      endpoints
        .getComments(id, objType)
        .then((list) => !cancelled && setItems(list))
        .catch(() => !cancelled && setItems([]))
        .finally(() => !cancelled && setLoading(false));
    }
    return () => {
      cancelled = true;
    };
  }, [id, commentId, objType]);

  // Cold deep-link (no router state): fetch the post so the header renders.
  useEffect(() => {
    if (commentId || post) return;
    let cancelled = false;
    endpoints.getPost(id).then((p) => !cancelled && setPost(p)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, commentId, post]);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else if (commentId) navigate(`/post/${type}/${id}`);
    else navigate('/home');
  }

  function openThread(c: OBComment) {
    navigate(`/post/${type}/${id}/c/${c.id}`);
  }

  function mutateComment(cid: string, patch: CommentPatch) {
    setFocused((f) => (f && f.id === cid ? { ...f, ...patch } : f));
    setItems((list) => list.map((c) => (c.id === cid ? { ...c, ...patch } : c)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimistic: OBComment = {
      id: tempId,
      author: {
        id: user?.id ?? 'me',
        name: user?.fullName ?? 'You',
        username: user?.username ?? 'you',
        avatar: user?.imageUrl ?? '',
      },
      body: value,
      createdAt: 'now',
      reactions: 0,
      reposts: 0,
      replies: 0,
      liked: false,
      bookmarked: false,
    };
    setItems((list) => [optimistic, ...list]);
    setText('');
    if (commentId) setFocused((f) => (f ? { ...f, replies: f.replies + 1 } : f));
    else setPost((p) => (p ? { ...p, comments: p.comments + 1 } : p));

    try {
      const created = await endpoints.addComment(id, value, objType, commentId);
      setItems((list) => list.map((c) => (c.id === tempId ? { ...optimistic, id: created.id } : c)));
    } catch {
      setItems((list) => list.filter((c) => c.id !== tempId));
      if (commentId) setFocused((f) => (f ? { ...f, replies: Math.max(0, f.replies - 1) } : f));
      else setPost((p) => (p ? { ...p, comments: Math.max(0, p.comments - 1) } : p));
      setText(value);
    } finally {
      setSending(false);
    }
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(e as unknown as FormEvent);
    }
  }

  return (
    <div className="postdetail">
      <header className="postdetail__head glass">
        <button type="button" className="iconbtn" onClick={goBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1>{commentId ? 'Thread' : 'Post'}</h1>
      </header>

      <div className="postdetail__body card">
        {/* Focused item, pinned at the top. */}
        {commentId ? (
          focused ? (
            <div className="postdetail__focus">
              <CommentRow
                comment={focused}
                postId={id}
                variant="anchor"
                onReplyFocus={() => inputRef.current?.focus()}
                onMutate={mutateComment}
              />
            </div>
          ) : loading ? (
            <FocusSkeleton />
          ) : (
            <div className="postdetail__missing">This comment is unavailable.</div>
          )
        ) : post ? (
          <div className="postdetail__focus">
            <PostCard post={post} detail onCommentClick={() => inputRef.current?.focus()} />
          </div>
        ) : (
          <FocusSkeleton />
        )}

        {/* Reply composer. */}
        <form className="postdetail__compose" onSubmit={submit}>
          <Avatar src={user?.imageUrl ?? ''} alt={user?.fullName ?? 'You'} size={40} />
          <textarea
            ref={inputRef}
            className="postdetail__input"
            placeholder={commentId && focused ? `Reply to @${focused.author.username}` : 'Post your reply'}
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <button
            type="submit"
            className="postdetail__send btn btn--brand"
            disabled={!text.trim() || sending}
          >
            <Send size={16} />
            Reply
          </button>
        </form>

        {/* Flat reply list. */}
        <div className="postdetail__replies">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="cmt cmt--skeleton">
                <div className="skeleton skeleton--avatar" />
                <div className="cmt__main">
                  <div className="skeleton" style={{ width: '40%', height: 11 }} />
                  <div className="skeleton" style={{ width: '92%', height: 11, marginTop: 9 }} />
                  <div className="skeleton" style={{ width: '60%', height: 11, marginTop: 6 }} />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="postdetail__empty">
              {commentId ? 'No replies yet.' : 'No comments yet. Be the first to reply.'}
            </div>
          ) : (
            items.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                postId={id}
                variant="row"
                onOpen={openThread}
                onMutate={mutateComment}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FocusSkeleton() {
  return (
    <div className="cmt cmt--skeleton postdetail__focus">
      <div className="skeleton skeleton--avatar" />
      <div className="cmt__main">
        <div className="skeleton" style={{ width: '45%', height: 12 }} />
        <div className="skeleton" style={{ width: '95%', height: 12, marginTop: 10 }} />
        <div className="skeleton" style={{ width: '80%', height: 12, marginTop: 6 }} />
      </div>
    </div>
  );
}
