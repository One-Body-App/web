import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, HandHeart, MessageCircle, PenLine, Plus, Repeat2, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ReactionRail } from '@/components/ReactionRail';
import { TurnstileGate } from '@/components/TurnstileGate';
import { EmptyState, PageHeader, Segmented } from '@/components/ui';

// Standalone Turnstile only enforces when a site key is configured.
const PRAYER_TURNSTILE_ENABLED = Boolean(
  (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY ?? '').trim()
);
import { endpoints } from '@/api/endpoints';
import {
  getReactionTotal,
  patchReactionCounts,
  type FullReactionKind,
} from '@/api/reactions';
import { useApiMutation } from '@/api/useApi';
import {
  MOCK_PRAYERS,
  prayerApi,
  type Prayer,
  type PrayerCategory,
  type PrayerReaction,
} from '@/api/prayer';
import { useFeedTelemetry } from '@/telemetry/feedTelemetry';
import './prayer.css';

type Tab = 'wall' | 'testimonies' | 'mine';
const TABS: { key: Tab; label: string }[] = [
  { key: 'wall', label: 'Wall' },
  { key: 'testimonies', label: 'Testimonies' },
  { key: 'mine', label: 'My Prayers' },
];

const CATEGORY_LABEL: Record<PrayerCategory, string> = {
  request: 'Prayer Request',
  exhortation: 'Exhortation',
  testimony: 'Testimony',
  answer: 'Answered',
  myPrayers: 'My Prayer',
};

// Web-only: pair each prayer type with the same emoji the mobile app uses
// (app/src/components/listItems/BaseItem.tsx). Stored as Unicode code-point
// escapes to keep the source ASCII-only.
const CATEGORY_EMOJI: Record<PrayerCategory, string> = {
  request: '\u{1F64F}', // folded hands
  exhortation: '\u{1F5E3}\u{FE0F}', // speaking head
  testimony: '\u{1F64C}', // raising hands
  answer: '\u{1F64C}', // raising hands
  myPrayers: '\u{1F64F}', // folded hands
};

const COMPOSE_CATEGORIES: { key: PrayerCategory; label: string }[] = [
  { key: 'request', label: 'Request' },
  { key: 'exhortation', label: 'Exhortation' },
  { key: 'testimony', label: 'Testimony' },
];

function rejectBlockedPrayerRepost() {
  window.alert('Only public prayer requests, exhortations, or testimonies can be reposted.');
}

export function PrayerWall() {
  const [tab, setTab] = useState<Tab>('wall');
  const [composeOpen, setComposeOpen] = useState(false);

  const [meId, setMeId] = useState('');
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  // Refs guard against overlapping loads and track pagination across renders.
  const loadingRef = useRef(false);
  const endRef = useRef(false);
  const pageRef = useRef(0);
  const meIdRef = useRef('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const didInitRef = useRef(false);

  // Loads the next page and appends it (de-duped). An empty page marks the end of
  // the feed — an infinite scroll over every prayer (newest first) with no client cap.
  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || endRef.current) return;
    loadingRef.current = true;
    const isInitial = pageRef.current === 0;
    if (isInitial) setInitialLoading(true);
    else setLoadingMore(true);
    try {
      if (isInitial && !meIdRef.current) {
        const me = await endpoints.getMyProfileMapped().catch(() => null);
        meIdRef.current = me?.id ?? '';
        setMeId(meIdRef.current);
      }
      const nextPage = pageRef.current + 1;
      const batch = await prayerApi.list(nextPage, meIdRef.current);
      if (batch.length === 0) {
        // Empty page => we've reached the end of the feed.
        endRef.current = true;
        setReachedEnd(true);
      } else {
        pageRef.current = nextPage;
        setPrayers((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = prev.slice();
          for (const p of batch) if (!seen.has(p.id)) merged.push(p);
          return merged;
        });
      }
    } catch {
      // Network/CORS/auth failure: show the offline fallback on first load, then stop.
      if (pageRef.current === 0) setPrayers(MOCK_PRAYERS);
      endRef.current = true;
      setReachedEnd(true);
    } finally {
      loadingRef.current = false;
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Reset to page 1 (after posting a prayer or marking one answered).
  const reload = useCallback(() => {
    pageRef.current = 0;
    endRef.current = false;
    setReachedEnd(false);
    setPrayers([]);
    setInitialLoading(true);
    void loadNextPage();
  }, [loadNextPage]);

  // Kick off the first page on mount via a callback ref (web lint disallows useEffect).
  const rootRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && !didInitRef.current) {
        didInitRef.current = true;
        void loadNextPage();
      }
    },
    [loadNextPage],
  );

  // Infinite scroll: a callback ref wires an IntersectionObserver to the sentinel as it
  // mounts/unmounts, loading the next page when it nears the viewport.
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void loadNextPage();
        },
        { rootMargin: '600px 0px' },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [loadNextPage],
  );

  const list = useMemo(() => {
    if (tab === 'testimonies') return prayers.filter((p) => p.answered);
    if (tab === 'mine') return meId ? prayers.filter((p) => p.authorId === meId) : [];
    return prayers;
  }, [tab, prayers, meId]);

  return (
    <div ref={rootRef}>
      <PageHeader
        title="Prayer Wall"
        subtitle="Bring your requests to the Body, and pray for one another."
        action={
          <button type="button" className="btn btn--brand" onClick={() => setComposeOpen(true)}>
            <Plus size={18} strokeWidth={2.5} />
            Share
          </button>
        }
      />

      <div className="prayer-wall__tabs">
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </div>

      {initialLoading && prayers.length === 0 ? (
        <PrayerSkeleton />
      ) : (
        <>
          {list.map((p) => (
            <PrayerCard key={p.id} prayer={p} meId={meId} onChanged={reload} />
          ))}

          {list.length === 0 && !initialLoading && !loadingMore ? (
            <EmptyState
              icon={<HandHeart size={30} />}
              title={
                tab === 'mine'
                  ? 'You haven’t shared a prayer yet'
                  : tab === 'testimonies'
                    ? 'No testimonies yet'
                    : 'The wall is quiet'
              }
              body={
                tab === 'mine'
                  ? 'Tap Share to post your first request.'
                  : 'Be the first to share a prayer with the Body.'
              }
            />
          ) : null}

          {/* Infinite-scroll sentinel; present until the full feed is exhausted. */}
          {!reachedEnd ? (
            <div ref={sentinelRef} className="prayer-wall__sentinel" aria-hidden="true">
              {loadingMore ? <PrayerSkeleton /> : null}
            </div>
          ) : null}
        </>
      )}

      {composeOpen ? (
        <PrayerComposer
          onClose={() => setComposeOpen(false)}
          onPosted={() => {
            setComposeOpen(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

export function PrayerCard({
  prayer,
  meId,
  onChanged,
  detail = false,
  onCommentClick,
}: {
  prayer: Prayer;
  meId: string;
  onChanged: () => void;
  detail?: boolean;
  onCommentClick?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [reactionOverride, setReactionOverride] = useState<{
    prayerId: string;
    myReaction: PrayerReaction | null;
    counts: Prayer['reactions'];
  } | null>(null);
  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [repostDelta, setRepostDelta] = useState(0);
  const [isReposting, setIsReposting] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [testimony, setTestimony] = useState('');
  const track = useFeedTelemetry();

  const anonymous = prayer.isPrivate;
  const reactionState =
    reactionOverride?.prayerId === prayer.id
      ? reactionOverride
      : { prayerId: prayer.id, myReaction: prayer.myReaction, counts: prayer.reactions };
  const { myReaction, counts } = reactionState;
  const total = getReactionTotal(counts);
  const isMine = Boolean(meId) && prayer.authorId === meId;
  const repostCount = Math.max(0, prayer.reposts + repostDelta);
  const canRepostPrayer =
    !prayer.isPrivate &&
    !prayer.answered &&
    (prayer.category === 'request' || prayer.category === 'exhortation' || prayer.category === 'testimony');

  function react(kind: PrayerReaction) {
    const wasActive = myReaction === kind;
    const previousCounts = counts;
    const previousReaction = myReaction;
    const nextReaction = wasActive ? null : kind;
    setReactionOverride({
      prayerId: prayer.id,
      counts: patchReactionCounts(counts, previousReaction, nextReaction),
      myReaction: nextReaction,
    });
    const req = wasActive ? prayerApi.removeReaction(prayer.id) : prayerApi.react(prayer.id, kind);
    req.catch(() => {
      setReactionOverride({
        prayerId: prayer.id,
        counts: previousCounts,
        myReaction: previousReaction,
      });
    });
    track(
      wasActive ? 'reaction_removed' : 'reaction',
      wasActive ? 'post_reaction_remove' : 'post_reaction_add',
      { reactionType: kind },
    );
  }

  function openComments() {
    if (detail) {
      onCommentClick?.();
      return;
    }
    track('open_comments', 'post_comment_open', { postType: 'prayer' });
    navigate(`/post/prayer/${prayer.id}`, { state: { prayer } });
  }

  function openRepostMenu() {
    if (!canRepostPrayer) {
      rejectBlockedPrayerRepost();
      return;
    }
    setRepostMenuOpen((open) => !open);
  }

  function repostPrayer() {
    if (!canRepostPrayer || isReposting) {
      if (!canRepostPrayer) rejectBlockedPrayerRepost();
      return;
    }
    setRepostMenuOpen(false);
    setIsReposting(true);
    setRepostDelta((count) => count + 1);
    track('repost', 'post_repost', { repostType: 'repost', sourceType: 'prayer' });
    endpoints.repost(prayer.id, 'prayer').catch(() => {
      setRepostDelta((count) => Math.max(0, count - 1));
      window.alert('Unable to repost right now. Please try again.');
    }).finally(() => setIsReposting(false));
  }

  function quotePrayer() {
    if (!canRepostPrayer) {
      rejectBlockedPrayerRepost();
      return;
    }
    setRepostMenuOpen(false);
    track('quote', 'post_quote_create', { repostType: 'quote', sourceType: 'prayer' });
    navigate('/post/new', {
      state: {
        backgroundLocation: location,
        quote: {
          sourceId: prayer.id,
          sourceType: 'prayer',
          author: prayer.authorName,
          username: prayer.authorUsername ?? prayer.authorName.replace(/\s+/g, '').toLowerCase(),
          avatar: prayer.authorAvatar,
          body: prayer.content,
        },
      },
    });
  }

  function toggleDefaultReaction() {
    react(myReaction ?? 'love');
  }

  async function confirmAnswered() {
    await prayerApi.markAnswered(prayer.id, testimony.trim()).catch(() => {});
    setAnswerOpen(false);
    onChanged();
  }

  return (
    <article className={detail ? 'prayer prayer--detail' : 'prayer card'}>
      <header className="prayer__head">
        <Avatar
          src={anonymous ? '/brand/avatar1.png' : prayer.authorAvatar}
          alt={anonymous ? 'Anonymous' : prayer.authorName}
          size={42}
        />
        <div className="prayer__id">
          <strong>{anonymous ? 'Anonymous' : prayer.authorName}</strong>
          <span>{prayer.time}</span>
        </div>
        <span className={`prayer__cat prayer__cat--${prayer.answered ? 'answer' : prayer.category}`}>
          <span className="prayer__cat-emoji" aria-hidden="true">
            {CATEGORY_EMOJI[prayer.answered ? 'answer' : prayer.category]}
          </span>
          {prayer.answered ? 'Answered' : CATEGORY_LABEL[prayer.category]}
        </span>
      </header>

      <p className="prayer__content">{prayer.content}</p>

      {prayer.answered && prayer.testimony ? (
        <div className="prayer__answered">
          <strong>🙌 Prayer Answered</strong>
          <p>{prayer.testimony}</p>
        </div>
      ) : null}

      <footer className="prayer__actions">
        <ReactionRail
          activeReaction={myReaction}
          total={total}
          onToggleDefault={toggleDefaultReaction}
          onSelect={(kind: FullReactionKind) => react(kind)}
          ariaLabel="React to prayer"
        />
        <button type="button" className="prayer__action" onClick={openComments} aria-label="Comments">
          <MessageCircle size={22} />
          {prayer.comments > 0 ? <span>{prayer.comments}</span> : null}
        </button>
        <div className="prayer__repost-wrap" onMouseLeave={() => setRepostMenuOpen(false)}>
          {repostMenuOpen ? (
            <button
              type="button"
              className="prayer__action"
              onClick={openRepostMenu}
              aria-label="Repost"
              aria-haspopup="menu"
              aria-expanded="true"
              disabled={isReposting}
            >
              <Repeat2 size={22} />
              {repostCount > 0 ? <span>{repostCount}</span> : null}
            </button>
          ) : (
            <button
              type="button"
              className="prayer__action"
              onClick={openRepostMenu}
              aria-label="Repost"
              aria-haspopup="menu"
              aria-expanded="false"
              disabled={isReposting}
            >
              <Repeat2 size={22} />
              {repostCount > 0 ? <span>{repostCount}</span> : null}
            </button>
          )}
          {repostMenuOpen ? (
            <div className="prayer__repost-menu glass" role="menu">
              <button type="button" className="prayer__repost-item" role="menuitem" onClick={repostPrayer}>
                <Repeat2 size={17} />
                <span>Repost</span>
              </button>
              <button type="button" className="prayer__repost-item" role="menuitem" onClick={quotePrayer}>
                <PenLine size={16} />
                <span>Quote Post</span>
              </button>
            </div>
          ) : null}
        </div>
        {isMine && !prayer.answered ? (
          <button
            type="button"
            className="prayer__answer-btn"
            onClick={() => setAnswerOpen((o) => !o)}
          >
            <Check size={15} /> Mark answered
          </button>
        ) : null}
      </footer>

      {answerOpen ? (
        <div className="prayer__answer-form">
          <textarea
            value={testimony}
            onChange={(e) => setTestimony(e.target.value)}
            placeholder="Share how God answered… (optional)"
            aria-label="Answered prayer testimony"
            maxLength={150}
            rows={3}
          />
          <div className="prayer__answer-actions">
            <button type="button" className="btn" onClick={() => setAnswerOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--brand" onClick={confirmAnswered}>
              Save testimony
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PrayerComposer({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PrayerCategory>('request');
  const [isPrivate, setIsPrivate] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { mutate, loading } = useApiMutation(
    (b: {
      content: string;
      category: PrayerCategory;
      private: boolean;
      turnstileToken?: string;
    }) => prayerApi.create(b),
  );

  const turnstilePassed = !PRAYER_TURNSTILE_ENABLED || Boolean(turnstileToken);
  const canSubmit = Boolean(content.trim()) && turnstilePassed && !loading;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await mutate({
      content: content.trim(),
      category,
      private: isPrivate,
      turnstileToken: turnstileToken ?? undefined,
    });
    onPosted();
  }

  return (
    <dialog className="prayer-modal" aria-label="Share a prayer" open>
      <button
        type="button"
        className="prayer-modal__backdrop"
        onClick={onClose}
        aria-label="Close prayer composer"
      />
      <form className="prayer-modal__panel card" onSubmit={submit}>
        <header className="prayer-modal__head">
          <h2>Share a prayer</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What can the Body pray with you about?"
          aria-label="Prayer request"
          rows={5}
          maxLength={1000}
        />
        <div className="prayer-modal__cats">
          {COMPOSE_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`chip${category === c.key ? ' is-active' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="prayer-modal__private">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            aria-label="Post anonymously"
          />
          Post anonymously
        </label>
        {PRAYER_TURNSTILE_ENABLED ? (
          <div className="prayer-modal__turnstile">
            <TurnstileGate
              action="prayer-wall-submit"
              size="flexible"
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
            />
          </div>
        ) : null}
        <div className="prayer-modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--brand" disabled={!canSubmit}>
            {loading ? 'Sharing…' : 'Share prayer'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function PrayerSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card prayer-skeleton">
          <div className="skeleton prayer-skeleton__title" />
          <div className="skeleton prayer-skeleton__line" />
          <div className="skeleton prayer-skeleton__line prayer-skeleton__line--short" />
        </div>
      ))}
    </>
  );
}
