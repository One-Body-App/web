import { useMemo, useState, type FormEvent } from 'react';
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
import { useApiMutation, useApiQuery } from '@/api/useApi';
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

  const { data, loading, refetch } = useApiQuery(
    async () => {
      const me = await endpoints.getMyProfileMapped().catch(() => null);
      const list = await prayerApi.list(1, me?.id);
      return { meId: me?.id ?? '', list };
    },
    { fallback: { meId: '', list: MOCK_PRAYERS } },
  );

  const meId = data?.meId ?? '';
  const all = data?.list ?? MOCK_PRAYERS;

  const list = useMemo(() => {
    if (tab === 'testimonies') return all.filter((p) => p.answered);
    if (tab === 'mine') return meId ? all.filter((p) => p.authorId === meId) : [];
    return all;
  }, [tab, all, meId]);

  return (
    <div>
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

      <div style={{ marginBottom: 'var(--sp-16)' }}>
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </div>

      {loading && !data ? (
        <PrayerSkeleton />
      ) : list.length ? (
        list.map((p) => <PrayerCard key={p.id} prayer={p} meId={meId} onChanged={refetch} />)
      ) : (
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
      )}

      {composeOpen ? (
        <PrayerComposer
          onClose={() => setComposeOpen(false)}
          onPosted={() => {
            setComposeOpen(false);
            refetch();
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
        <div key={i} className="card" style={{ padding: 'var(--sp-16)', marginBottom: 'var(--sp-12)' }}>
          <div className="skeleton" style={{ width: '40%', height: 12 }} />
          <div className="skeleton" style={{ width: '100%', height: 12, marginTop: 14 }} />
          <div className="skeleton" style={{ width: '70%', height: 12, marginTop: 8 }} />
        </div>
      ))}
    </>
  );
}
