import { Link } from 'react-router-dom';
import { MessageCircle, PenSquare } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { EmptyState, PageHeader } from '@/components/ui';
import { conversations as mockConversations } from '@/data/mock';
import { chatApi, type ChatConversation } from '@/api/chat';
import { useApiQuery } from '@/api/useApi';
import { useChatConnection } from '@/chat/useChat';
import './Messages.css';

const FALLBACK: ChatConversation[] = mockConversations.map((c) => ({
  id: c.user.id,
  conversationType: 'direct',
  peerUserId: c.user.id,
  name: c.user.name,
  username: c.user.username,
  avatar: c.user.avatar,
  lastMessagePreview: c.lastMessage,
  updatedAt: '',
  unread: c.unread,
}));

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
  const { data } = useApiQuery(() => chatApi.conversations(), { fallback: FALLBACK });
  const list = data ?? FALLBACK;

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
      ) : (
        <EmptyState
          icon={<MessageCircle size={30} />}
          title="No messages yet"
          body="Start a conversation from someone's profile to connect one-on-one."
        />
      )}
    </div>
  );
}
