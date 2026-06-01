import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid3x3, LogOut, MapPin, Settings, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PostCard } from '@/components/PostCard';
import { Segmented } from '@/components/ui';
import { useAuth } from '@/auth/context';
import { posts, profilePosts } from '@/data/mock';
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
    bio: 'Daughter of the King 👑 · Worship & community · Pointing hearts to Jesus.',
    followers: 12400,
    following: 867,
  };

  const profileQ = useApiQuery(() => endpoints.getMyProfileMapped(), { fallback: fallbackProfile });
  const profile = profileQ.data ?? fallbackProfile;

  const postsQ = useApiQuery(() => endpoints.getUserPosts(profile.id), {
    enabled: Boolean(profile.id),
    fallback: posts.slice(0, 2),
    deps: [profile.id],
  });
  const myPosts = postsQ.data ?? posts.slice(0, 2);

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
        <p className="profile__loc">
          <MapPin size={15} /> Austin, TX · Joined 2024
        </p>

        <div className="profile__stats">
          <div>
            <strong>{formatCount(myPosts.length)}</strong>
            <span>Posts</span>
          </div>
          <div>
            <strong>{formatCount(profile.followers)}</strong>
            <span>Followers</span>
          </div>
          <div>
            <strong>{formatCount(profile.following)}</strong>
            <span>Following</span>
          </div>
        </div>

        <button type="button" className="btn btn--brand btn--block">
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
        <>
          <div className="profile__grid">
            {profilePosts.map((p, i) => (
              <button
                type="button"
                key={p.id}
                className="profile__grid-item"
                aria-label={`Open post ${i + 1}`}
              >
                <img src={p.image} alt="" loading="lazy" />
                <span className="profile__grid-overlay">
                  <Grid3x3 size={18} />
                </span>
              </button>
            ))}
          </div>
          <div className="profile__feed">
            {myPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </>
      ) : (
        <div className="profile__about card">
          <h3>About</h3>
          <p>
            Worship leader at Hillside Community Church. Passionate about gathering the global church
            in prayer and song. Coffee enthusiast, book lover, and forever amazed by grace.
          </p>
          <ul className="profile__about-list">
            <li>
              <span>Church</span>Hillside Community Church
            </li>
            <li>
              <span>Serving</span>Worship · Kids Ministry
            </li>
            <li>
              <span>Favorite verse</span>Psalm 133:1
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
