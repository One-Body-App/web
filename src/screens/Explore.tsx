import { useEffect, useState } from 'react';
import { Flame, Search } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader, SectionHeader } from '@/components/ui';
import { suggestedAccounts, trendingTopics, type OBUser } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
import { useApiMutation, useApiQuery } from '@/api/useApi';
import './Explore.css';

function FollowButton({ userId }: { userId: string }) {
  const [following, setFollowing] = useState(false);
  const follow = useApiMutation((id: string) => endpoints.followUser(id));
  const unfollow = useApiMutation((id: string) => endpoints.unfollowUser(id));

  function toggle() {
    const next = !following;
    setFollowing(next);
    (next ? follow.mutate(userId) : unfollow.mutate(userId));
  }

  return (
    <button className={`btn btn--sm ${following ? 'btn--outline' : 'btn--accent'}`} onClick={toggle}>
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

function UserRow({ user }: { user: OBUser }) {
  return (
    <div className="discover-row card">
      <Avatar src={user.avatar} alt={user.name} size={52} verified={user.verified} />
      <div className="discover-row__meta">
        <strong>{user.name}</strong>
        <span className="discover-row__handle">
          @{user.username}
          {user.kind ? (
            <>
              {' · '}
              <span className="discover-row__kind">{user.kind}</span>
            </>
          ) : null}
        </span>
        {user.bio ? <p className="discover-row__bio">{user.bio}</p> : null}
      </div>
      <FollowButton userId={user.id} />
    </div>
  );
}

export function Explore() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const isSearching = debouncedQ.length >= 2;

  const suggested = useApiQuery(() => endpoints.getSuggestedUsers(), {
    fallback: suggestedAccounts,
  });
  const results = useApiQuery(() => endpoints.searchUsers(debouncedQ), {
    enabled: isSearching,
    fallback: [],
    deps: [debouncedQ],
  });

  const suggestedList = suggested.data ?? suggestedAccounts;
  const resultList = results.data ?? [];

  return (
    <div>
      <PageHeader title="Explore" />

      <div className="search">
        <Search size={20} className="search__icon" />
        <input
          className="search__input"
          placeholder="Search people, churches, topics…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isSearching ? (
        <>
          <SectionHeader title={results.loading ? 'Searching…' : `Results for “${debouncedQ}”`} />
          <div className="discover-list">
            {resultList.length ? (
              resultList.map((u) => <UserRow key={u.id} user={u} />)
            ) : results.loading ? null : (
              <p className="muted" style={{ padding: 'var(--sp-16)' }}>
                No people found. Try another name.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <SectionHeader title="Trending in the Body" />
          <div className="topic-bubbles">
            {trendingTopics.map((t, i) => (
              <button
                key={t.tag}
                className={`topic-bubble topic-bubble--${(i % 4) + 1}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {t.hot ? <Flame size={13} /> : null}
                <span className="topic-bubble__tag">#{t.tag}</span>
                <span className="topic-bubble__count">{t.posts}</span>
              </button>
            ))}
          </div>

          <SectionHeader title="Voices to follow" />
          <div className="discover-list">
            {suggestedList.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
