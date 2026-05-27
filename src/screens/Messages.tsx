import { Link } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/ui';
import { conversations } from '@/data/mock';
import './Messages.css';

export function Messages() {
  return (
    <div>
      <PageHeader
        title="Messages"
        action={
          <button className="iconbtn" aria-label="New message">
            <PenSquare size={20} />
          </button>
        }
      />

      <ul className="convo-list">
        {conversations.map((c) => (
          <li key={c.id}>
            <Link to={`/messages/${c.id}`} className={`convo${c.unread ? ' is-unread' : ''}`}>
              <Avatar src={c.user.avatar} alt={c.user.name} size={54} verified={c.user.verified} />
              <div className="convo__meta">
                <div className="convo__top">
                  <strong>{c.user.name}</strong>
                  <span className="convo__time">{c.time}</span>
                </div>
                <p className="convo__preview">{c.lastMessage}</p>
              </div>
              {c.unread ? <span className="convo__badge">{c.unread}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
