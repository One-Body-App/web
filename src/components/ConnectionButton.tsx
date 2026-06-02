import { useMemo, useState } from 'react';
import { useAccountProfileContext } from '@/auth/AccountProfileContext';
import { endpoints } from '@/api/endpoints';
import { useApiMutation } from '@/api/useApi';

interface ConnectionButtonProps {
  targetId: string;
  name: string;
  disconnectedVariant?: 'accent' | 'brand';
}

export function ConnectionButton({
  targetId,
  name,
  disconnectedVariant = 'accent',
}: ConnectionButtonProps) {
  const { profile, refetch } = useAccountProfileContext();
  const [localConnected, setLocalConnected] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const connect = useApiMutation((id: string) => endpoints.followUser(id));
  const disconnect = useApiMutation((id: string) => endpoints.unfollowUser(id));
  const normalizedTargetId = targetId.trim();
  const isSelf = Boolean(profile?.id && normalizedTargetId && profile.id === normalizedTargetId);
  const profileConnected = useMemo(
    () => Boolean(normalizedTargetId && (profile?.followingIds ?? []).includes(normalizedTargetId)),
    [normalizedTargetId, profile?.followingIds],
  );
  const connected = isSelf || (localConnected ?? profileConnected);
  const saving = connect.loading || disconnect.loading;
  const disabled = saving || !normalizedTargetId || isSelf;
  const disconnectedClass = disconnectedVariant === 'brand' ? 'btn--brand' : 'btn--accent';
  const buttonLabel = connected ? `Disconnect from ${name}` : `Connect with ${name}`;

  async function toggleConnection() {
    if (disabled) return;

    setMessage('');
    const nextConnected = !connected;
    const result = await (nextConnected
      ? connect.mutate(normalizedTargetId)
      : disconnect.mutate(normalizedTargetId));

    if (result === undefined) {
      setMessage(`Unable to update your connection with ${name}.`);
      return;
    }

    setLocalConnected(nextConnected);
    setMessage(nextConnected ? `Connected with ${name}.` : `Disconnected from ${name}.`);
    refetch();
  }

  return (
    <span className="connection-action">
      <button
        type="button"
        className={`btn btn--sm ${connected ? 'btn--outline' : disconnectedClass}`}
        onClick={toggleConnection}
        disabled={disabled}
        aria-label={buttonLabel}
      >
        {connected ? 'Connected' : 'Connect'}
      </button>
      {message ? (
        <small className="connection-action__status" aria-live="polite">
          {message}
        </small>
      ) : null}
    </span>
  );
}
