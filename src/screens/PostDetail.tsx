import { useCallback, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PostCard } from '@/components/PostCard';
import { CommentRow, type CommentPatch } from '@/components/CommentRow';
import { endpoints, type CommentContentType, type OBComment } from '@/api/endpoints';
import { prayerApi, type Prayer } from '@/api/prayer';
import type { OBPost } from '@/data/mock';
import { useAuth } from '@/auth/context';
import { PrayerCard } from './PrayerWall';
import './PostDetail.css';

type DetailSnapshot = {
  key: string;
  meId: string;
  post: OBPost | null;
  prayer: Prayer | null;
  focused: OBComment | null;
  items: OBComment[];
  loading: boolean;
  loaded: boolean;
  error: boolean;
};

type DetailLoadParams = {
  key: string;
  type: CommentContentType;
  id: string;
  commentId?: string;
  initialPost?: OBPost | null;
  initialPrayer?: Prayer | null;
};

const EMPTY_DETAIL: DetailSnapshot = {
  key: '',
  meId: '',
  post: null,
  prayer: null,
  focused: null,
  items: [],
  loading: false,
  loaded: false,
  error: false,
};

function createPostDetailStore() {
  let snapshot = EMPTY_DETAIL;
  let activeRequest = 0;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const update = (patch: Partial<DetailSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    emit();
  };

  const load = ({
    key,
    type,
    id,
    commentId,
    initialPost = null,
    initialPrayer = null,
  }: DetailLoadParams, force = false) => {
    if (!id) return;
    if (!force && snapshot.key === key && (snapshot.loading || snapshot.loaded)) return;

    const requestId = activeRequest + 1;
    activeRequest = requestId;
    update({
      key,
      meId: snapshot.key === key ? snapshot.meId : '',
      post: initialPost,
      prayer: initialPrayer,
      focused: null,
      items: [],
      loading: true,
      loaded: false,
      error: false,
    });

    const run = async () => {
      const me = await endpoints.getMyProfileMapped().catch(() => null);
      const meId = me?.id ?? '';
      let post = initialPost;
      let prayer = initialPrayer;
      let focused: OBComment | null = null;
      let items: OBComment[] = [];

      if (type === 'prayer') {
        prayer = await prayerApi.get(id, meId).catch(() => prayer);
      } else if (!commentId) {
        post = initialPost ?? (await endpoints.getPost(id, meId).catch(() => null));
      }

      if (commentId) {
        const thread = await endpoints.getCommentThread(id, commentId, type, meId).catch(() => null);
        focused = thread?.root ?? null;
        items = thread?.replies ?? [];
      } else {
        items = await endpoints.getComments(id, type, 1, meId).catch(() => []);
      }

      if (activeRequest !== requestId) return;
      update({
        key,
        meId,
        post,
        prayer,
        focused,
        items,
        loading: false,
        loaded: true,
        error: false,
      });
    };

    run().catch(() => {
      if (activeRequest !== requestId) return;
      update({ loading: false, loaded: true, error: true });
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    reload: (params: DetailLoadParams) => load(params, true),
    patchComment: (key: string, commentId: string, patch: CommentPatch) => {
      if (snapshot.key !== key) return;
      update({
        focused:
          snapshot.focused?.id === commentId ? { ...snapshot.focused, ...patch } : snapshot.focused,
        items: snapshot.items.map((comment) =>
          comment.id === commentId ? { ...comment, ...patch } : comment,
        ),
      });
    },
    prependComment: (key: string, comment: OBComment, isReply: boolean) => {
      if (snapshot.key !== key) return;
      update({
        items: [comment, ...snapshot.items],
        focused:
          isReply && snapshot.focused
            ? { ...snapshot.focused, replies: snapshot.focused.replies + 1 }
            : snapshot.focused,
        post:
          !isReply && snapshot.post
            ? { ...snapshot.post, comments: snapshot.post.comments + 1 }
            : snapshot.post,
        prayer:
          !isReply && snapshot.prayer
            ? { ...snapshot.prayer, comments: snapshot.prayer.comments + 1 }
            : snapshot.prayer,
      });
    },
  };
}

const postDetailStore = createPostDetailStore();

function normalizeType(value?: string): CommentContentType {
  if (value === 'prayer' || value === 'rss' || value === 'watch') return value;
  return 'social';
}

function detailKey(type: CommentContentType, id: string, commentId?: string) {
  return `${type}:${id}:${commentId ?? ''}`;
}

/**
 * X-style post/comment detail. The focused item (post, prayer, or a comment
 * when `:commentId` is present) is pinned at the top.
 */
export function PostDetail() {
  const { type = 'social', id = '', commentId } = useParams();
  const objType = normalizeType(type);
  const routeKey = detailKey(objType, id, commentId);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const routerState = location.state as { post?: OBPost; prayer?: Prayer } | null;
  const initialPost = routerState?.post ?? null;
  const initialPrayer = routerState?.prayer ?? null;
  const loadParams = { key: routeKey, type: objType, id, commentId, initialPost, initialPrayer };
  const snapshot = useSyncExternalStore(
    postDetailStore.subscribe,
    postDetailStore.getSnapshot,
    postDetailStore.getSnapshot,
  );
  const isCurrent = snapshot.key === routeKey;
  const post = isCurrent ? snapshot.post : initialPost;
  const prayer = isCurrent ? snapshot.prayer : initialPrayer;
  const focused = isCurrent ? snapshot.focused : null;
  const items = isCurrent ? snapshot.items : [];
  const loading = !isCurrent || snapshot.loading;

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        postDetailStore.load({ key: routeKey, type: objType, id, commentId, initialPost, initialPrayer });
      }
    },
    [routeKey, objType, id, commentId, initialPost, initialPrayer],
  );

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else if (commentId) navigate(`/post/${objType}/${id}`);
    else navigate('/home');
  }

  function openThread(c: OBComment) {
    navigate(`/post/${objType}/${id}/c/${c.id}`);
  }

  function mutateComment(cid: string, patch: CommentPatch) {
    postDetailStore.patchComment(routeKey, cid, patch);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);

    try {
      const created = await endpoints.addComment(id, value, objType, commentId);
      postDetailStore.prependComment(routeKey, created, Boolean(commentId));
      setText('');
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

  const hideComposer = objType === 'prayer' && Boolean(prayer?.answered);

  return (
    <div className="postdetail" ref={loadRef}>
      <header className="postdetail__head glass">
        <button type="button" className="iconbtn" onClick={goBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1>{commentId ? 'Thread' : objType === 'prayer' ? 'Prayer' : 'Post'}</h1>
      </header>

      <div className="postdetail__body card">
        {commentId ? (
          focused ? (
            <div className="postdetail__focus">
              <CommentRow
                comment={focused}
                postId={id}
                type={objType}
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
        ) : objType === 'prayer' ? (
          prayer ? (
            <div className="postdetail__focus">
              <PrayerCard
                prayer={prayer}
                meId={snapshot.meId}
                onChanged={() => postDetailStore.reload(loadParams)}
                detail
                onCommentClick={() => inputRef.current?.focus()}
              />
            </div>
          ) : (
            <FocusSkeleton />
          )
        ) : post ? (
          <div className="postdetail__focus">
            <PostCard post={post} detail onCommentClick={() => inputRef.current?.focus()} />
          </div>
        ) : (
          <FocusSkeleton />
        )}

        {hideComposer ? (
          <div className="postdetail__notice">Praise God, prayer answered. Comments are closed.</div>
        ) : (
          <form className="postdetail__compose" onSubmit={submit}>
            <Avatar src={user?.imageUrl ?? ''} alt={user?.fullName ?? 'You'} size={40} />
            <textarea
              ref={inputRef}
              className="postdetail__input"
              placeholder={commentId && focused ? `Reply to @${focused.author.username}` : 'Post your reply'}
              aria-label={commentId && focused ? `Reply to ${focused.author.username}` : 'Post reply'}
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
        )}

        <div className="postdetail__replies">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="cmt cmt--skeleton">
                <div className="skeleton skeleton--avatar" />
                <div className="cmt__main">
                  <div className="skeleton cmt-skeleton__title" />
                  <div className="skeleton cmt-skeleton__line" />
                  <div className="skeleton cmt-skeleton__line cmt-skeleton__line--short" />
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
                type={objType}
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
        <div className="skeleton cmt-skeleton__title" />
        <div className="skeleton cmt-skeleton__line" />
        <div className="skeleton cmt-skeleton__line cmt-skeleton__line--short" />
      </div>
    </div>
  );
}
