import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid3x3, LogOut, MapPin, Settings, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PostCard } from '@/components/PostCard';
import { EmptyState, Segmented } from '@/components/ui';
import { useAuth } from '@/auth/context';
import { endpoints, type MyProfile } from '@/api/endpoints';
import { useApiQuery } from '@/api/useApi';
import './Profile.css';

type Tab = 'posts' | 'about';

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

export function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('posts');

  const fallbackProfile: MyProfile = {
    id: user?.id ?? '',
    name: user?.fullName ?? 'One Body member',
    username: user?.username ?? 'member',
    avatar: user?.imageUrl ?? '/brand/avatar2.png',
    email: user?.email,
    emailVerified: true,
    isProfileCompleted: true,
    interests: [],
    followers: 0,
    following: 0,
    followingIds: [],
  };

  const profileQ = useApiQuery(() => endpoints.getMyProfileMapped(), { fallback: fallbackProfile });
  const profile = profileQ.data ?? fallbackProfile;

  const postsQ = useApiQuery(() => endpoints.getUserPosts(profile.id), {
    enabled: Boolean(profile.id),
    fallback: [],
    deps: [profile.id],
  });
  const myPosts = postsQ.data ?? [];
  const gridPosts = myPosts.filter((p) => Boolean(p.image));

  // Church type is persisted as an id; resolve it to a display name.
  const churchTypesQ = useApiQuery(() => endpoints.getChurchTypes(), { fallback: [] });
  const churchLabel = useMemo(() => {
    const raw = profile.profile?.churchType;
    if (!raw) return '';
    const match = (churchTypesQ.data ?? []).find((c) => c._id === raw || c.id === raw);
    const base = match?.name ?? raw;
    const sub = profile.profile?.churchSubType;
    return sub ? `${base} · ${sub}` : base;
  }, [churchTypesQ.data, profile.profile?.churchType, profile.profile?.churchSubType]);

  const locationAddress = profile.profile?.location?.address;
  const servingLabel = profile.profile?.whatIDo?.name;
  const verse = profile.favoriteVerse;
  const aboutHasContent = Boolean(profile.bio || churchLabel || servingLabel || verse);

  const metaParts = [
    locationAddress,
    profile.joinedYear ? `Joined ${profile.joinedYear}` : null,
  ].filter(Boolean);

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  if (!user) return null;

  return (
    <div className="profile">
      <div className="profile__cover" />

      <div className="profile__head">
        <div className="profile__avatar">
          <Avatar src={profile.avatar} alt={profile.name} size={104} ring />
        </div>
        <div className="profile__actions">
          <button type="button" className="iconbtn profile__icon" aria-label="Settings" onClick={() => navigate('/settings')}>
            <Settings size={20} />
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={handleSignOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      <div className="profile__info">
        <h1 className="profile__name">{profile.name}</h1>
        <p className="profile__handle">@{profile.username}</p>
        {profile.bio ? <p className="profile__bio">{profile.bio}</p> : null}
        {verse ? (
          <blockquote className="profile__verse">
            <span className="profile__verse-ref">{verse.reference}</span>
            {verse.text ? <span className="profile__verse-text">{`“${verse.text}”`}</span> : null}
          </blockquote>
        ) : null}
        {metaParts.length > 0 ? (
          <p className="profile__loc">
            <MapPin size={15} /> {metaParts.join(' · ')}
          </p>
        ) : null}

        <div className="profile__stats">
          <div>
            <strong>{formatCount(myPosts.length)}</strong>
            <span>Posts</span>
          </div>
          <div>
            <strong>{formatCount(profile.followers)}</strong>
            <span>Connectors</span>
          </div>
          <div>
            <strong>{formatCount(profile.following)}</strong>
            <span>Connections</span>
          </div>
        </div>

        <button type="button" className="btn btn--brand btn--block" onClick={() => navigate('/profile/edit')}>
          <Sparkles size={18} /> Edit profile
        </button>
      </div>

      <div className="profile__tabs">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: 'posts', label: 'Posts' },
            { key: 'about', label: 'About' },
          ]}
        />
      </div>

      {tab === 'posts' ? (
        myPosts.length === 0 ? (
          <EmptyState
            icon={<Grid3x3 size={28} />}
            title="No posts yet"
            body="Posts you share will show up here."
          />
        ) : (
          <>
            {gridPosts.length > 0 ? (
              <div className="profile__grid">
                {gridPosts.map((p, i) => (
                  <button
                    type="button"
                    key={p.id}
                    className="profile__grid-item"
                    aria-label={`Open post ${i + 1}`}
                    onClick={() => navigate(`/post/social/${p.id}`, { state: { post: p } })}
                  >
                    <img src={p.image} alt="" loading="lazy" />
                    <span className="profile__grid-overlay">
                      <Grid3x3 size={18} />
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="profile__feed">
              {myPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </>
        )
      ) : aboutHasContent ? (
        <div className="profile__about card">
          <h3>About</h3>
          {profile.bio ? <p>{profile.bio}</p> : null}
          <ul className="profile__about-list">
            {churchLabel ? (
              <li>
                <span>Church</span>
                {churchLabel}
              </li>
            ) : null}
            {servingLabel ? (
              <li>
                <span>Serving</span>
                {servingLabel}
              </li>
            ) : null}
            {verse ? (
              <li>
                <span>Favorite verse</span>
                {verse.reference}
              </li>
            ) : null}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Nothing here yet"
          body="Add a bio, church, and favorite verse from Edit profile."
        />
      )}
    </div>
  );
}
