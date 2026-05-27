import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { suggestedAccounts, trendingTopics } from '@/data/mock';

export function DiscoverRail() {
  const navigate = useNavigate();

  return (
    <aside className="shell__rail">
      <div className="rail-card card">
        <h3 className="rail-card__title">
          <TrendingUp size={18} /> Trending in the Body
        </h3>
        <ul className="rail-trend">
          {trendingTopics.slice(0, 5).map((t) => (
            <li key={t.tag}>
              <button className="rail-trend__item" onClick={() => navigate('/explore')}>
                <span className="rail-trend__tag">#{t.tag}</span>
                <span className="rail-trend__count">{t.posts} posts</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rail-card card">
        <h3 className="rail-card__title">
          <Sparkles size={18} /> People to follow
        </h3>
        <ul className="rail-people">
          {suggestedAccounts.slice(0, 3).map((u) => (
            <li key={u.id} className="rail-people__item">
              <Avatar src={u.avatar} alt={u.name} size={42} verified={u.verified} />
              <span className="rail-people__meta">
                <strong>{u.name}</strong>
                <small>@{u.username}</small>
              </span>
              <button className="btn btn--outline btn--sm">Follow</button>
            </li>
          ))}
        </ul>
      </div>

      <p className="rail-foot">
        One Body · Built with love for the global church.
        <br />
        <span className="muted">© {new Date().getFullYear()} One Body</span>
      </p>
    </aside>
  );
}
