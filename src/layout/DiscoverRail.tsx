import { useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, HandHeart, Play, PlayCircle, Sparkles, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ConnectionButton } from '@/components/ConnectionButton';
import type { OBUser } from '@/data/mock';
/* sponsored sidebar */
import SidebarAd from '@/components/ads/SidebarAd';
import { endpoints } from '@/api/endpoints';
import { useApiQuery } from '@/api/useApi';
import { prayerApi } from '@/api/prayer';
import { watchApi } from '@/api/watch';

const COPYRIGHT_YEAR = new Date().getFullYear();

type RailTopic = {
  tag: string;
  posts: string;
  hot?: boolean;
  popularity?: number;
};
type TopicTier = 1 | 2 | 3 | 4;
type TopicStyle = CSSProperties & {
  '--topic-delay': string;
};

function parsePopularity(topic: RailTopic): number {
  if (typeof topic.popularity === 'number' && Number.isFinite(topic.popularity)) {
    return topic.popularity;
  }
  const posts = topic.posts.trim().toLowerCase();
  const multiplier = posts.endsWith('k') ? 1000 : 1;
  const value = Number(posts.replace(/k$/, ''));
  return Number.isFinite(value) ? value * multiplier : 1;
}

function getTopicTier(popularity: number, min: number, max: number): TopicTier {
  if (max <= min) return 1;
  const normalized = (popularity - min) / (max - min);
  if (normalized < 0.25) return 1;
  if (normalized < 0.55) return 2;
  if (normalized < 0.8) return 3;
  return 4;
}

/** True at >=900px, where the rail is visible — gates its data fetches. */
function useWideScreen(): boolean {
  const query = '(min-width: 900px)';
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
    () => false,
  );
}

export function DiscoverRail() {
  const navigate = useNavigate();
  const wide = useWideScreen();

  const { data: prayers } = useApiQuery(() => prayerApi.list(1), { enabled: wide });
  const { data: videos } = useApiQuery(() => watchApi.feed(1), { enabled: wide });
  const { data: people } = useApiQuery(() => endpoints.getSuggestedUsers(), { enabled: wide });
  const { data: trends } = useApiQuery(() => endpoints.getTrendingTags(), { enabled: wide });

  const prayerList = (prayers ?? []).slice(0, 3);
  const videoList = (videos ?? []).slice(0, 3);
  const suggested = (people ?? []).filter((u) => u.id && u.id !== 'unknown');
  const peopleList = suggested.slice(0, 3);
  const trendList = useMemo(() => (trends ?? []).slice(0, 8), [trends]);
  const trendPills = useMemo(() => {
    const popularities = trendList.map(parsePopularity);
    const min = popularities.length ? Math.min(...popularities) : 1;
    const max = popularities.length ? Math.max(...popularities) : 1;
    return trendList.map((topic, index) => ({
      topic,
      tier: getTopicTier(popularities[index] ?? 1, min, max),
    }));
  }, [trendList]);

  if (!wide) return null;

  return (
    <aside className="shell__rail">
      {/* Prayer Wall */}
      {prayerList.length ? (
        <div className="rail-card card">
          <h3 className="rail-card__title">
            <HandHeart size={18} /> Prayer Wall
          </h3>
          <ul className="rail-list">
            {prayerList.map((p) => (
              <li key={p.id}>
                <Link to="/prayer" className="rail-list__item">
                  <Avatar
                    src={p.isPrivate ? '' : p.authorAvatar}
                    alt={p.isPrivate ? 'Anonymous' : p.authorName}
                    size={34}
                  />
                  <span className="rail-list__meta">
                    <strong>{p.isPrivate ? 'Anonymous' : p.authorName}</strong>
                    <small>{p.content}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/prayer" className="rail-card__more">
            Open Prayer Wall
          </Link>
        </div>
      ) : null}

      {/* Watch */}
      {videoList.length ? (
        <div className="rail-card card">
          <h3 className="rail-card__title">
            <PlayCircle size={18} /> Watch
          </h3>
          <ul className="rail-watch">
            {videoList.map((v) => (
              <li key={v.id}>
                <Link to="/watch" className="rail-watch__item">
                  <span className="rail-watch__thumb">
                    <img src={v.thumbnail} alt="" loading="lazy" />
                    <Play size={16} fill="currentColor" />
                  </span>
                  <span className="rail-list__meta">
                    <strong>{v.title || v.authorName}</strong>
                    <small>{v.authorName}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/watch" className="rail-card__more">
            See all videos
          </Link>
        </div>
      ) : null}

      {/* Explore */}
      {trendList.length ? (
        <div className="rail-card card">
          <h3 className="rail-card__title">
            <TrendingUp size={18} /> Explore
          </h3>
          <div className="topic-bubbles rail-topic-bubbles">
            {trendPills.map(({ topic, tier }, i) => (
              <button
                type="button"
                key={topic.tag}
                className={`topic-bubble topic-bubble--tier-${tier} rail-topic-bubble`}
                {...{ style: { '--topic-delay': `${i * 35}ms` } as TopicStyle }}
                onClick={() => navigate(`/explore?q=${encodeURIComponent(topic.tag)}`)}
              >
                {topic.hot ? <Flame size={11} /> : null}
                <span className="topic-bubble__tag">#{topic.tag}</span>
                {topic.posts ? <span className="topic-bubble__count">{topic.posts}</span> : null}
              </button>
            ))}
          </div>
          <Link to="/explore" className="rail-card__more">
            Explore more
          </Link>
        </div>
      ) : null}

      {/* People to connect with */}
      {peopleList.length ? (
        <div className="rail-card card">
          <h3 className="rail-card__title">
            <Sparkles size={18} /> People to connect with
          </h3>
          <ul className="rail-people">
            {peopleList.map((u) => (
              <ConnectionRow key={u.id} user={u} />
            ))}
          </ul>
          <Link to="/explore" className="rail-card__more">
            Show more
          </Link>
        </div>
      ) : null}

      {/* sponsored sidebar: one small ad (web_sidebar zone) */}
      <SidebarAd />

      <p className="rail-foot">
        One Body · Built with love for the global church.
        <br />
        <span className="muted">© {COPYRIGHT_YEAR} One Body</span>
      </p>
    </aside>
  );
}

function ConnectionRow({ user }: { user: OBUser }) {
  return (
    <li className="rail-people__item">
      <Avatar src={user.avatar} alt={user.name} size={40} verified={user.verified} />
      <span className="rail-people__meta">
        <strong>{user.name}</strong>
        <small>@{user.username}</small>
      </span>
      <ConnectionButton targetId={user.id} name={user.name} disconnectedVariant="brand" />
    </li>
  );
}
