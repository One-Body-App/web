import { lazy, Suspense, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Film, Heart, Play, Smartphone } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { EmptyState, PageHeader } from '@/components/ui';
import { useApiQuery } from '@/api/useApi';
import { watchApi, type WatchVideo } from '@/api/watch';
import './watch.css';

// Defer the player (and hls.js) until a video is opened.
const WatchLightbox = lazy(() => import('@/components/WatchLightbox').then((m) => ({ default: m.WatchLightbox })));

type WatchTab = 'foryou' | 'sermons';

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function fmtDur(ms?: number) {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Only true 9:16 verticals are "shorts" (mirrors the mobile app's 0.04
 * tolerance). Everything else — 1:1, 4:3, 16:9, 4:5, … — is a "wide" video.
 */
const isShort = (v: WatchVideo) => Math.abs(v.aspectRatio - 9 / 16) <= 0.05;

export function Watch() {
  const [tab, setTab] = useState<WatchTab>('foryou');
  const [active, setActive] = useState<WatchVideo | null>(null);
  const { data, loading } = useApiQuery(() => watchApi.feed(1));
  const list = data ?? [];

  const shorts = list.filter(isShort);
  const wide = list.filter((v) => !isShort(v));
  // No backend "sermons" category yet — long-form landscape videos stand in.
  const sermons = wide;

  return (
    <div className="watch">
      <PageHeader title="Watch" subtitle="Sermons, shorts & moments from across the Body." />

      <div className="segmented watch__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'foryou'}
          className={`segmented__item${tab === 'foryou' ? ' is-active' : ''}`}
          onClick={() => setTab('foryou')}
        >
          For You
        </button>
        <button
          role="tab"
          aria-selected={tab === 'sermons'}
          className={`segmented__item${tab === 'sermons' ? ' is-active' : ''}`}
          onClick={() => setTab('sermons')}
        >
          Sermons
        </button>
      </div>

      {loading && !data ? (
        <WatchSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Film size={30} />}
          title="No videos yet"
          body="New videos from across the Body will show up here."
        />
      ) : tab === 'foryou' ? (
        <div className="watch-split">
          <section className="watch-col">
            <h2 className="watch-col__head">
              <Smartphone size={16} /> Shorts
            </h2>
            {shorts.length ? (
              <div className="watch-shorts">
                {shorts.map((v, i) => (
                  <ShortCard key={v.id} video={v} index={i} onOpen={setActive} />
                ))}
              </div>
            ) : (
              <p className="watch-col__empty">No shorts right now.</p>
            )}
          </section>

          <section className="watch-col">
            <h2 className="watch-col__head">
              <Film size={16} /> Videos
            </h2>
            {wide.length ? (
              <div className="watch-videos">
                {wide.map((v, i) => (
                  <WideCard key={v.id} video={v} index={i} onOpen={setActive} />
                ))}
              </div>
            ) : (
              <p className="watch-col__empty">No videos right now.</p>
            )}
          </section>
        </div>
      ) : sermons.length ? (
        <div className="watch-sermons">
          {sermons.map((v, i) => (
            <WideCard key={v.id} video={v} index={i} onOpen={setActive} large />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Film size={30} />}
          title="No sermons yet"
          body="Full messages and teachings will show up here."
        />
      )}

      <AnimatePresence>
        {active ? (
          <Suspense fallback={null}>
            <WatchLightbox video={active} onClose={() => setActive(null)} />
          </Suspense>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------- Cards ----------------------------- */
function ShortCard({ video, index, onOpen }: { video: WatchVideo; index: number; onOpen: (v: WatchVideo) => void }) {
  return (
    <button
      className="wshort"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      onClick={() => onOpen(video)}
      aria-label={`Play ${video.title || 'short'}`}
    >
      <img className="wshort__img" src={video.thumbnail} alt="" loading="lazy" />
      <span className="wshort__shade" />
      <span className="wshort__play">
        <Play size={18} fill="currentColor" />
      </span>
      {video.durationMs ? <span className="wshort__dur">{fmtDur(video.durationMs)}</span> : null}
      <span className="wshort__cap">
        <strong>{video.title || video.caption || video.authorName}</strong>
        <span className="wshort__by">
          <Avatar src={video.authorAvatar} alt={video.authorName} size={18} /> {video.authorName}
        </span>
      </span>
    </button>
  );
}

function WideCard({
  video,
  index,
  onOpen,
  large = false,
}: {
  video: WatchVideo;
  index: number;
  onOpen: (v: WatchVideo) => void;
  large?: boolean;
}) {
  return (
    <article className={`wwide card${large ? ' wwide--lg' : ''}`} style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
      <button
        className="wwide__frame"
        style={{ aspectRatio: String(video.aspectRatio || 16 / 9) }}
        onClick={() => onOpen(video)}
        aria-label={`Play ${video.title || 'video'}`}
      >
        <img src={video.thumbnail} alt="" loading="lazy" />
        <span className="wwide__play">
          <Play size={22} fill="currentColor" />
        </span>
        {video.durationMs ? <span className="wwide__dur">{fmtDur(video.durationMs)}</span> : null}
      </button>
      <div className="wwide__meta">
        <Avatar src={video.authorAvatar} alt={video.authorName} size={36} />
        <div className="wwide__info">
          <strong>{video.title || video.authorName}</strong>
          {large && video.caption ? <p>{video.caption}</p> : null}
          <span className="wwide__by">
            {video.authorName} · {video.time}
          </span>
        </div>
        <span className="wwide__count">
          <Heart size={15} /> {formatCount(video.reactions)}
        </span>
      </div>
    </article>
  );
}

function WatchSkeleton() {
  return (
    <div className="watch-split">
      <section className="watch-col">
        <div className="skeleton" style={{ width: 80, height: 14, marginBottom: 'var(--sp-12)' }} />
        <div className="watch-shorts">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 'var(--r-base)' }} />
          ))}
        </div>
      </section>
      <section className="watch-col">
        <div className="skeleton" style={{ width: 80, height: 14, marginBottom: 'var(--sp-12)' }} />
        <div className="watch-videos">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-base)' }} />
          ))}
        </div>
      </section>
    </div>
  );
}
