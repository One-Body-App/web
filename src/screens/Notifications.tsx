import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronUp,
  HandHeart,
  Heart,
  MessageCircle,
  MoreVertical,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { EmptyState, PageHeader } from '@/components/ui';
import { notifications as mockNotifications } from '@/data/mock';
import { endpoints } from '@/api/endpoints';
import { useApiMutation, useApiQuery } from '@/api/useApi';
import {
  getNotificationCategories,
  getPrimaryNotificationCategory,
  type NotificationCategoryKey,
} from './notifications/notificationCategories';
import { resolveNotificationWebRoute } from './notifications/notificationLinking';
import type { InboxNotification, NotificationKind } from './notifications/types';
import { useNotificationsRealtime } from './notifications/useNotificationsRealtime';
import './Notifications.css';

type SortMode = 'newest' | 'oldest';
type MutableCategory = Exclude<NotificationCategoryKey, 'all'>;

const ICONS: Record<NotificationKind, { Icon: LucideIcon; color: string }> = {
  reaction: { Icon: Heart, color: 'var(--react-love)' },
  comment: { Icon: MessageCircle, color: 'var(--sapphire)' },
  follow: { Icon: UserPlus, color: 'var(--success)' },
  prayer: { Icon: HandHeart, color: 'var(--react-pray)' },
  mention: { Icon: AtSign, color: 'var(--warning)' },
};

const CATEGORY_OPTIONS: { key: NotificationCategoryKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tagged', label: 'Tagged' },
  { key: 'feed', label: 'Feed' },
  { key: 'prayers', label: 'Prayers' },
  { key: 'blog_posts', label: 'Blog posts' },
  { key: 'serve', label: 'Serve' },
  { key: 'go', label: 'Go' },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<NotificationCategoryKey, string>>(
  (acc, option) => {
    acc[option.key] = option.label;
    return acc;
  },
  {} as Record<NotificationCategoryKey, string>,
);

const ACTIVITY_SIGNAL_REGEX = /\bcomment|reaction|reacted|message|messaged|reply|replied|like\b/i;

const containsActivitySignal = (value?: string) =>
  typeof value === 'string' && ACTIVITY_SIGNAL_REGEX.test(value.toLowerCase());

const isActivityNotification = (item: InboxNotification) =>
  containsActivitySignal(item.notificationType) ||
  containsActivitySignal(item.notificationSource) ||
  containsActivitySignal(`${item.title} ${item.body}`);

const isCreatorNotification = (item: InboxNotification, approvedCreators: Set<string>) =>
  isActivityNotification(item) && Boolean(item.actorId) && approvedCreators.has(item.actorId as string);

// Relative timestamp mirroring the mobile/feed `timeAgo` style.
function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const timestamp = (iso: string) => {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
};

export function Notifications() {
  const navigate = useNavigate();
  const { data, loading, refetch } = useApiQuery(() => endpoints.getNotifications(), {
    fallback: mockNotifications,
  });
  const { data: approvedCreatorIds } = useApiQuery(
    () => endpoints.getFollowingApprovedCreatorIds(),
    { fallback: [] },
  );

  const markRead = useApiMutation((id: string) => endpoints.markNotificationRead(id));
  const deleteNotif = useApiMutation((id: string) => endpoints.deleteNotification(id));
  const markAll = useApiMutation(() => endpoints.markAllNotificationsRead());

  const [activeCategory, setActiveCategory] = useState<NotificationCategoryKey>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [mutedCategories, setMutedCategories] = useState<MutableCategory[]>([]);
  const [readOverrides, setReadOverrides] = useState<Record<string, true>>({});
  const [deletedIds, setDeletedIds] = useState<Record<string, true>>({});
  const [allRead, setAllRead] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // Remembers the trigger that opened the menu so focus can return to it on close.
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  function closeMenu() {
    setOpenMenuId(null);
    menuTriggerRef.current?.focus();
    menuTriggerRef.current = null;
  }

  // Refetch on realtime activity (chat socket events) and when the tab regains focus.
  useNotificationsRealtime(refetch);

  const approvedCreators = useMemo(
    () => new Set((approvedCreatorIds ?? []).flatMap((id) => (id.trim() ? [id.trim()] : []))),
    [approvedCreatorIds],
  );

  const { creators, regular } = useMemo(() => {
    // Single pass: drop deleted, resolve read state, drop muted + off-category.
    const visible = (data ?? []).reduce<InboxNotification[]>((acc, item) => {
      if (deletedIds[item.id]) return acc;
      const next = { ...item, read: item.read || allRead || Boolean(readOverrides[item.id]) };
      if (mutedCategories.includes(getPrimaryNotificationCategory(next))) return acc;
      if (activeCategory !== 'all' && !getNotificationCategories(next).includes(activeCategory)) {
        return acc;
      }
      acc.push(next);
      return acc;
    }, []);

    visible.sort((first, second) =>
      sortMode === 'newest'
        ? timestamp(second.createdAt) - timestamp(first.createdAt)
        : timestamp(first.createdAt) - timestamp(second.createdAt),
    );

    const creatorItems: InboxNotification[] = [];
    const regularItems: InboxNotification[] = [];
    for (const item of visible) {
      if (isCreatorNotification(item, approvedCreators)) creatorItems.push(item);
      else regularItems.push(item);
    }
    return { creators: creatorItems, regular: regularItems };
  }, [activeCategory, allRead, approvedCreators, data, deletedIds, mutedCategories, readOverrides, sortMode]);

  const isEmpty = creators.length === 0 && regular.length === 0;

  function markItemRead(item: InboxNotification) {
    if (item.read || allRead || readOverrides[item.id]) return;
    setReadOverrides((prev) => ({ ...prev, [item.id]: true }));
    markRead.mutate(item.sourceId);
  }

  function openNotification(item: InboxNotification) {
    markItemRead(item);
    const route = resolveNotificationWebRoute(item);
    if (!route) return;
    if (route.kind === 'internal') navigate(route.to);
    else window.open(route.url, '_blank', 'noopener,noreferrer');
  }

  function removeItem(item: InboxNotification) {
    setOpenMenuId(null);
    setDeletedIds((prev) => ({ ...prev, [item.id]: true }));
    deleteNotif.mutate(item.sourceId);
  }

  function muteCategory(category: MutableCategory) {
    setOpenMenuId(null);
    setMutedCategories((prev) => (prev.includes(category) ? prev : [...prev, category]));
  }

  function markAllRead() {
    setAllRead(true);
    markAll.mutate(undefined as void);
  }

  function renderCard(item: InboxNotification) {
    const { Icon, color } = ICONS[item.kind];
    const primaryCategory = getPrimaryNotificationCategory(item);
    const menuOpen = openMenuId === item.id;
    return (
      <li key={item.id} className={`notif${item.read ? '' : ' is-unread'}`}>
        <button type="button" className="notif__main" onClick={() => openNotification(item)}>
          <span className="notif__avatar">
            <Avatar src={item.iconUrl ?? ''} alt={item.title} size={46} />
            <span className="notif__kind" style={{ background: color }}>
              <Icon size={12} />
            </span>
          </span>
          <span className="notif__body">
            <span className="notif__title">{item.title}</span>
            {item.body ? <span className="notif__text">{item.body}</span> : null}
          </span>
        </button>

        <span className="notif__aside">
          {item.read ? null : <span className="notif__dot" aria-label="Unread" />}
          <span className="notif__time">{formatRelativeTime(item.createdAt)}</span>
          <span className="notif__menu">
            <button
              type="button"
              className="notif__menu-btn"
              aria-haspopup="menu"
              {...{ 'aria-expanded': menuOpen ? 'true' : 'false' }}
              aria-label="Notification options"
              onClick={(event) => {
                if (menuOpen) {
                  closeMenu();
                  return;
                }
                menuTriggerRef.current = event.currentTarget;
                setOpenMenuId(item.id);
              }}
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen ? (
              <span
                className="notif__menu-pop"
                role="menu"
                tabIndex={-1}
                ref={(node) => {
                  // Move focus into the menu when it opens.
                  if (node) (node.querySelector('button') as HTMLButtonElement | null)?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    closeMenu();
                  }
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="notif__menu-item"
                  onClick={() => {
                    setOpenMenuId(null);
                    markItemRead(item);
                  }}
                >
                  <Check size={16} /> Mark as read
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="notif__menu-item"
                  onClick={() => muteCategory(primaryCategory)}
                >
                  <BellOff size={16} /> Mute {CATEGORY_LABELS[primaryCategory]}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="notif__menu-item notif__menu-item--danger"
                  onClick={() => removeItem(item)}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </span>
            ) : null}
          </span>
        </span>
      </li>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          <button type="button" className="btn btn--ghost btn--sm" onClick={markAllRead}>
            Mark all read
          </button>
        }
      />

      <div className="notif-controls">
        <div className="notif-chips" aria-label="Filter notifications">
          {CATEGORY_OPTIONS.map((option) => {
            const active = activeCategory === option.key;
            return (
              <button
                type="button"
                key={option.key}
                className={`notif-chip${active ? ' is-active' : ''}`}
                {...{ 'aria-pressed': active ? 'true' : 'false' }}
                onClick={() => setActiveCategory(option.key)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="notif-sort"
          onClick={() => setSortMode((current) => (current === 'newest' ? 'oldest' : 'newest'))}
        >
          {sortMode === 'newest' ? 'Most recent' : 'Oldest first'}
          {sortMode === 'newest' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {openMenuId ? (
        <button
          type="button"
          className="notif__backdrop"
          aria-label="Close menu"
          onClick={closeMenu}
        />
      ) : null}

      {loading && !data ? (
        <p className="notif-status">Loading notifications…</p>
      ) : isEmpty ? (
        <EmptyState
          icon={<Bell size={32} />}
          title="No notifications yet"
          body="When people react, comment, connect, or pray for you, it'll show up here."
        />
      ) : (
        <>
          {creators.length ? (
            <>
              <h2 className="notif-section">Creators</h2>
              <ul className="notif-list">{creators.map(renderCard)}</ul>
            </>
          ) : null}
          {regular.length ? (
            <>
              {creators.length ? <h2 className="notif-section">All notifications</h2> : null}
              <ul className="notif-list">{regular.map(renderCard)}</ul>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
