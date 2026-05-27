import { useMemo, useState, type FormEvent } from 'react';
import { Check, HandHeart, Plus, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { EmptyState, PageHeader, Segmented } from '@/components/ui';
import { REACTIONS } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
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
        subtitle="Bring your requests to the Body — and pray for one another."
        action={
          <button className="btn btn--brand" onClick={() => setComposeOpen(true)}>
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
}: {
  prayer: Prayer;
  meId: string;
  onChanged: () => void;
}) {
  const [myReaction, setMyReaction] = useState<PrayerReaction | null>(prayer.myReaction);
  const [counts, setCounts] = useState(prayer.reactions);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [testimony, setTestimony] = useState('');
  const track = useFeedTelemetry();

  const anonymous = prayer.isPrivate;
  const total = counts.love + counts.pray + counts.rejoice;
  const isMine = Boolean(meId) && prayer.authorId === meId;

  function react(kind: PrayerReaction) {
    const wasActive = myReaction === kind;
    setCounts((prev) => {
      const next = { ...prev };
      if (myReaction) next[myReaction] -= 1;
      if (myReaction !== kind) next[kind] += 1;
      return next;
    });
    setMyReaction((prev) => (prev === kind ? null : kind));
    const req = wasActive ? prayerApi.removeReaction(prayer.id) : prayerApi.react(prayer.id, kind);
    req.catch(() => {});
    track(
      wasActive ? 'reaction_removed' : 'reaction',
      wasActive ? 'post_reaction_remove' : 'post_reaction_add',
      { reactionType: kind },
    );
  }

  async function confirmAnswered() {
    await prayerApi.markAnswered(prayer.id, testimony.trim()).catch(() => {});
    setAnswerOpen(false);
    onChanged();
  }

  return (
    <article className="prayer card">
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
        {REACTIONS.map((r) => {
          const active = myReaction === r.kind;
          return (
            <button
              key={r.kind}
              className={`prayer__react${active ? ' is-active' : ''}`}
              style={active ? { color: r.color } : undefined}
              onClick={() => react(r.kind)}
              title={r.label}
            >
              <span aria-hidden>{r.emoji}</span>
              {counts[r.kind] > 0 ? <small>{counts[r.kind]}</small> : null}
            </button>
          );
        })}
        <span className="prayer__total">
          {total > 0 ? `${total} praying` : 'Be the first to pray'}
        </span>
        {isMine && !prayer.answered ? (
          <button className="prayer__answer-btn" onClick={() => setAnswerOpen((o) => !o)}>
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
            maxLength={150}
            rows={3}
          />
          <div className="prayer__answer-actions">
            <button className="btn" onClick={() => setAnswerOpen(false)}>
              Cancel
            </button>
            <button className="btn btn--brand" onClick={confirmAnswered}>
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
  const { mutate, loading } = useApiMutation(
    (b: { content: string; category: PrayerCategory; private: boolean }) => prayerApi.create(b),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await mutate({ content: content.trim(), category, private: isPrivate });
    onPosted();
  }

  return (
    <div className="prayer-modal" role="dialog" aria-modal="true">
      <div className="prayer-modal__backdrop" onClick={onClose} />
      <form className="prayer-modal__panel card" onSubmit={submit}>
        <header className="prayer-modal__head">
          <h2>Share a prayer</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What can the Body pray with you about?"
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
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Post anonymously
        </label>
        <div className="prayer-modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--brand" disabled={!content.trim() || loading}>
            {loading ? 'Sharing…' : 'Share prayer'}
          </button>
        </div>
      </form>
    </div>
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
