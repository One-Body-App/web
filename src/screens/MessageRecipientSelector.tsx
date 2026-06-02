import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/ui';
import { endpoints } from '@/api/endpoints';
import type { ChatConversation } from '@/api/chat';
import { useApiQuery } from '@/api/useApi';
import type { OBUser } from '@/data/mock';
import './Messages.css';

const EMPTY_USERS: OBUser[] = [];

interface MessageRecipientSelectorProps {
  autoFocus?: boolean;
  className?: string;
  onSelect?: () => void;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function userMatchesQuery(user: OBUser, query: string): boolean {
  const value = normalizeSearch(query);
  if (!value) return false;
  return (
    user.name.toLowerCase().includes(value) ||
    user.username.toLowerCase().includes(value) ||
    `@${user.username.toLowerCase()}`.includes(value)
  );
}

function byName(left: OBUser, right: OBUser): number {
  return left.name.localeCompare(right.name);
}

function sortedUsers(users: readonly OBUser[]): OBUser[] {
  const sorted = users.slice();
  sorted.sort(byName);
  return sorted;
}

function groupContacts(users: OBUser[]): Array<{ letter: string; users: OBUser[] }> {
  const groups = new Map<string, OBUser[]>();
  for (const user of users) {
    const letter = user.name.trim().slice(0, 1).toUpperCase() || '#';
    const list = groups.get(letter) ?? [];
    list.push(user);
    groups.set(letter, list);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([letter, group]) => ({ letter, users: sortedUsers(group) }));
}

export function MessageRecipientSelector({
  autoFocus = false,
  className,
  onSelect,
}: MessageRecipientSelectorProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const canSearchServer = deferredQuery.length >= 2;

  const contactsQuery = useApiQuery(() => endpoints.getFollowingUsers());
  const serverSearchQuery = useApiQuery(() => endpoints.searchUsers(deferredQuery), {
    enabled: canSearchServer,
    deps: [deferredQuery],
  });

  const connectedContacts = useMemo(
    () => sortedUsers(contactsQuery.data ?? EMPTY_USERS),
    [contactsQuery.data],
  );
  const contactsById = useMemo(
    () => new Map(connectedContacts.map((contact) => [contact.id, contact])),
    [connectedContacts],
  );
  const groupedContacts = useMemo(() => groupContacts(connectedContacts), [connectedContacts]);
  const frequentContacts = useMemo(() => connectedContacts.slice(0, 2), [connectedContacts]);
  const searchResults = useMemo(() => {
    if (!deferredQuery) return EMPTY_USERS;

    const merged = new Map<string, OBUser>();
    for (const user of serverSearchQuery.data ?? EMPTY_USERS) {
      const connected = contactsById.get(user.id);
      if (connected) merged.set(connected.id, connected);
    }
    for (const user of connectedContacts) {
      if (userMatchesQuery(user, deferredQuery)) merged.set(user.id, user);
    }
    return Array.from(merged.values()).sort(byName);
  }, [connectedContacts, contactsById, deferredQuery, serverSearchQuery.data]);

  function openConversation(user: OBUser) {
    const conversation: ChatConversation = {
      id: user.id,
      conversationType: 'direct',
      peerUserId: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      lastMessagePreview: '',
      updatedAt: '',
      unread: 0,
    };
    onSelect?.();
    navigate(`/messages/${user.id}`, { state: conversation });
  }

  function renderContactRow(user: OBUser, showChatIcon = false) {
    return (
      <li key={user.id}>
        <button
          type="button"
          className="new-message__contact"
          onClick={() => openConversation(user)}
        >
          <Avatar src={user.avatar} alt={user.name} size={52} verified={user.verified} />
          <span className="new-message__contact-meta">
            <strong>{user.name}</strong>
            <span>@{user.username}</span>
          </span>
          {showChatIcon ? <MessageCircle size={21} className="new-message__contact-icon" /> : null}
        </button>
      </li>
    );
  }

  const hasQuery = deferredQuery.length > 0;
  const isLoadingContacts = contactsQuery.loading && connectedContacts.length === 0;
  const hasContactLoadError = Boolean(contactsQuery.error && connectedContacts.length === 0);
  const isSearching =
    hasQuery && canSearchServer && serverSearchQuery.loading && searchResults.length === 0;
  const selectorClassName = className
    ? `new-message__selector ${className}`
    : 'new-message__selector';

  return (
    <div className={selectorClassName}>
      <div className="new-message__search">
        <Search size={20} className="new-message__search-icon" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="new-message__search-input"
          placeholder="Search connected accounts"
          aria-label="Search connected accounts"
          autoFocus={autoFocus}
        />
      </div>

      {isLoadingContacts ? <div className="messages-status">Loading contacts&hellip;</div> : null}

      {hasContactLoadError ? (
        <div className="messages-status messages-status--error">
          Unable to load connected accounts right now.
        </div>
      ) : null}

      {hasContactLoadError ? null : hasQuery ? (
        <section className="new-message__section">
          <h2 className="new-message__section-title">
            {isSearching ? <>Searching&hellip;</> : 'Search results'}
          </h2>
          {searchResults.length ? (
            <ul className="new-message__list">
              {searchResults.map((user) => renderContactRow(user))}
            </ul>
          ) : isSearching ? null : (
            <EmptyState
              icon={<Search size={28} />}
              title="No connected accounts found"
              body="Only connected accounts can be selected for a direct message."
            />
          )}
        </section>
      ) : connectedContacts.length ? (
        <>
          {frequentContacts.length ? (
            <section className="new-message__section">
              <h2 className="new-message__section-title">Frequent</h2>
              <ul className="new-message__list">
                {frequentContacts.map((user) => renderContactRow(user, true))}
              </ul>
            </section>
          ) : null}

          <section className="new-message__section">
            <h2 className="new-message__section-title">All contacts</h2>
            {groupedContacts.map((group) => (
              <div key={group.letter} className="new-message__group">
                <h3 className="new-message__letter">{group.letter}</h3>
                <ul className="new-message__list">
                  {group.users.map((user) => renderContactRow(user))}
                </ul>
              </div>
            ))}
          </section>
        </>
      ) : isLoadingContacts ? null : (
        <EmptyState
          icon={<UserPlus size={28} />}
          title="No connected accounts yet"
          body="Follow or connect with someone first, then return here to start a direct message."
        />
      )}
    </div>
  );
}
