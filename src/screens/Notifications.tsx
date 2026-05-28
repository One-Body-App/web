import { useState } from 'react';
import { Heart, MessageCircle, AtSign, UserPlus, HandHeart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { PageHeader } from '@/components/ui';
import { notifications as mockNotifications, type OBNotification } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
import { useApiMutation, useApiQuery } from '@/api/useApi';
import './Notifications.css';

const ICONS: Record<OBNotification['kind'], { Icon: LucideIcon; color: string }> = {
  reaction: { Icon: Heart, color: 'var(--react-love)' },
  comment: { Icon: MessageCircle, color: 'var(--sapphire)' },
  follow: { Icon: UserPlus, color: 'var(--success)' },
  prayer: { Icon: HandHeart, color: 'var(--react-pray)' },
  mention: { Icon: AtSign, color: 'var(--warning)' },
};

export function Notifications() {
  const { data } = useApiQuery(() => endpoints.getNotifications(), { fallback: mockNotifications });
  const markRead = useApiMutation(() => endpoints.markAllNotificationsRead());
  const [allRead, setAllRead] = useState(false);

  const list = (data ?? mockNotifications).map((n) => (allRead ? { ...n, unread: false } : n));

  function markAll() {
    setAllRead(true);
    markRead.mutate(undefined as void);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          <button type="button" className="btn btn--ghost btn--sm" onClick={markAll}>
            Mark all read
          </button>
        }
      />

      <ul className="notif-list">
        {list.map((n) => {
          const { Icon, color } = ICONS[n.kind];
          return (
            <li key={n.id} className={`notif${n.unread ? ' is-unread' : ''}`}>
              <span className="notif__avatar">
                <Avatar src={n.user.avatar} alt={n.user.name} size={46} verified={n.user.verified} />
                <span className="notif__kind" style={{ background: color }}>
                  <Icon size={12} />
                </span>
              </span>
              <p className="notif__text">
                <strong>{n.user.name}</strong> {n.text}
                <span className="notif__time"> · {n.time}</span>
              </p>
              {n.unread ? <span className="notif__dot" /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
