import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HandHeart, Play, PlayCircle, Sparkles, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { suggestedAccounts, trendingTopics, type OBUser } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
import { useApiQuery } from '@/api/useApi';
import { MOCK_PRAYERS, prayerApi } from '@/api/prayer';
import { MOCK_VIDEOS, watchApi } from '@/api/watch';

/** True at >=1200px, where the rail is visible — gates its data fetches. */
function useWideScreen(): boolean {
  const query = '(min-width: 1200px)';
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setWide(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return wide;
}

export function DiscoverRail() {
  const navigate = useNavigate();
  const wide = useWideScreen();

  const { data: prayers } = useApiQuery(() => prayerApi.list(1), { fallback: MOCK_PRAYERS, enabled: wide });
  const { data: videos } = useApiQuery(() => watchApi.feed(1), { fallback: MOCK_VIDEOS, enabled: wide });
  const { data: people } = useApiQuery(() => endpoints.getSuggestedUsers(), {
    fallback: suggestedAccounts,
    enabled: wide,
  });
  const { data: trends } = useApiQuery(() => endpoints.getTrendingTags(), {
    fallback: trendingTopics,
    enabled: wide,
  });

  if (!wide) return null;

  // Fall back to sample content when a live list is empty so widgets stay populated.
  const prayerList = (prayers && prayers.length ? prayers : MOCK_PRAYERS).slice(0, 3);
  const videoList = (videos && videos.length ? videos : MOCK_VIDEOS).slice(0, 3);
  const suggested = (people ?? []).filter((u) => u.id && u.id !== 'unknown');
  const peopleList = (suggested.length ? suggested : suggestedAccounts).slice(0, 3);
  const trendList = (trends && trends.length ? trends : trendingTopics).slice(0, 5);

  return (
    <aside className="shell__rail">
      {/* Prayer Wall */}
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

      {/* Watch */}
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

      {/* Explore */}
      <div className="rail-card card">
        <h3 className="rail-card__title">
          <TrendingUp size={18} /> Explore
        </h3>
        <ul className="rail-trend">
          {trendList.map((t) => (
            <li key={t.tag}>
              <button className="rail-trend__item" onClick={() => navigate('/explore')}>
                <span className="rail-trend__tag">#{t.tag}</span>
                <span className="rail-trend__count">{t.posts ? `${t.posts} posts` : 'Trending'}</span>
              </button>
            </li>
          ))}
        </ul>
        <Link to="/explore" className="rail-card__more">
          Explore more
        </Link>
      </div>

      {/* Who to follow */}
      <div className="rail-card card">
        <h3 className="rail-card__title">
          <Sparkles size={18} /> Who to follow
        </h3>
        <ul className="rail-people">
          {peopleList.map((u) => (
            <FollowRow key={u.id} user={u} />
          ))}
        </ul>
        <Link to="/explore" className="rail-card__more">
          Show more
        </Link>
      </div>

      <p className="rail-foot">
        One Body · Built with love for the global church.
        <br />
        <span className="muted">© {new Date().getFullYear()} One Body</span>
      </p>
    </aside>
  );
}

function FollowRow({ user }: { user: OBUser }) {
  const [following, setFollowing] = useState(false);

  function toggle() {
    const next = !following;
    setFollowing(next);
    const req = next ? endpoints.followUser(user.id) : endpoints.unfollowUser(user.id);
    req.catch(() => setFollowing(!next));
  }

  return (
    <li className="rail-people__item">
      <Avatar src={user.avatar} alt={user.name} size={40} verified={user.verified} />
      <span className="rail-people__meta">
        <strong>{user.name}</strong>
        <small>@{user.username}</small>
      </span>
      <button
        className={`btn btn--sm ${following ? 'btn--outline' : 'btn--brand'}`}
        onClick={toggle}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </li>
  );
}
