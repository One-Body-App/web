import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Globe, Image as ImageIcon, MapPin, Smile, Users, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/auth/context';
import { endpoints } from '@/api/endpoints';
import './CreatePost.css';

const AUDIENCES = [
  { key: 'everyone', label: 'Everyone', Icon: Globe },
  { key: 'connections', label: 'Connections', Icon: Users },
];

export function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [audience, setAudience] = useState('everyone');
  const [publishing, setPublishing] = useState(false);

  const canPost = text.trim().length > 0 && !publishing;

  async function publish() {
    if (!canPost) return;
    setPublishing(true);
    try {
      await endpoints.createPost(text.trim());
    } catch {
      // Best-effort in dev (offline/CORS); still return to the feed.
    }
    navigate('/home', { replace: true });
  }

  return (
    <div className="compose">
      <header className="compose__head">
        <button className="iconbtn" onClick={() => navigate(-1)} aria-label="Cancel">
          <X size={22} />
        </button>
        <span className="compose__title">New Post</span>
        <button className="btn btn--brand btn--sm" disabled={!canPost} onClick={publish}>
          {publishing ? 'Posting…' : 'Post'}
        </button>
      </header>

      <div className="compose__body">
        <div className="compose__author">
          {user ? <Avatar src={user.imageUrl} alt={user.fullName} size={46} /> : null}
          <div>
            <strong>{user?.fullName}</strong>
            <button className="compose__audience">
              {(() => {
                const a = AUDIENCES.find((x) => x.key === audience) ?? AUDIENCES[0];
                const I = a.Icon;
                return (
                  <>
                    <I size={13} /> {a.label}
                  </>
                );
              })()}
            </button>
          </div>
        </div>

        <textarea
          className="compose__input"
          placeholder="Share a testimony, a verse, a prayer request, or what God is doing…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          rows={6}
        />

        <div className="compose__audience-pick">
          {AUDIENCES.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`chip${audience === key ? ' chip--active' : ''}`}
              onClick={() => setAudience(key)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <footer className="compose__toolbar">
        <button className="compose__tool" aria-label="Add photo">
          <ImageIcon size={22} />
          <span>Photo</span>
        </button>
        <button className="compose__tool" aria-label="Add verse">
          <BookOpen size={22} />
          <span>Verse</span>
        </button>
        <button className="compose__tool" aria-label="Add feeling">
          <Smile size={22} />
          <span>Feeling</span>
        </button>
        <button className="compose__tool" aria-label="Add location">
          <MapPin size={22} />
          <span>Place</span>
        </button>
      </footer>
    </div>
  );
}
