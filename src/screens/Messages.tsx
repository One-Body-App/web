import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, PenSquare, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { EmptyState, PageHeader } from '@/components/ui';
import { chatApi } from '@/api/chat';
import { useApiQuery } from '@/api/useApi';
import { useChatConnection } from '@/chat/useChat';
import { MessageRecipientSelector } from './MessageRecipientSelector';
import './Messages.css';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Messages() {
  useChatConnection();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const { data, error, loading } = useApiQuery(() => chatApi.conversations());
  const list = data ?? [];

  return (
    <div className="messages-screen">
      <PageHeader
        title="Messages"
        action={
          <button
            type="button"
            className="iconbtn"
            aria-label="New message"
            onClick={() => setIsSelectorOpen((open) => !open)}
          >
            <PenSquare size={20} />
          </button>
        }
      />

      {isSelectorOpen ? (
        <section className="messages-compose-panel" aria-label="New message">
          <header className="messages-compose-panel__head">
            <div>
              <h2 className="messages-compose-panel__title">New message</h2>
              <p className="messages-compose-panel__sub">Choose a connected account</p>
            </div>
            <button
              type="button"
              className="iconbtn messages-compose-panel__close"
              aria-label="Close new message"
              onClick={() => setIsSelectorOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <MessageRecipientSelector
            autoFocus
            className="messages-compose-panel__selector"
            onSelect={() => setIsSelectorOpen(false)}
          />
        </section>
      ) : null}

      {loading ? <div className="messages-status">Loading messages&hellip;</div> : null}

      {error && !loading ? (
        <div className="messages-status messages-status--error">
          Unable to load messages right now.
        </div>
      ) : null}

      {list.length ? (
        <ul className="convo-list">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                to={`/messages/${c.peerUserId ?? c.groupId ?? c.id}`}
                state={c}
                className={`convo${c.unread ? ' is-unread' : ''}`}
              >
                <Avatar src={c.avatar ?? '/brand/avatar1.png'} alt={c.name} size={52} />
                <div className="convo__meta">
                  <div className="convo__top">
                    <strong>{c.name}</strong>
                    <span className="convo__time">{timeAgo(c.updatedAt)}</span>
                  </div>
                  <p className="convo__preview">{c.lastMessagePreview || 'Start the conversation'}</p>
                </div>
                {c.unread ? <span className="convo__badge">{c.unread}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : !loading && !error ? (
        <EmptyState
          icon={<MessageCircle size={30} />}
          title="No messages yet"
          body="Press the compose button to find a connected account and start one-on-one."
        />
      ) : null}
    </div>
  );
}
