import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign,
  Bell,
  ChevronRight,
  CircleHelp,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  Newspaper,
  ShieldCheck,
  Trash2,
  UserPen,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/auth/context';
import { endpoints, type NotificationSettings } from '@/api/endpoints';
import { useApiMutation, useApiQuery } from '@/api/useApi';
import './Settings.css';

const NOTIFICATION_DEFAULTS: NotificationSettings = {
  pushNotificationsEnabled: true,
  connectionNotificationsEnabled: true,
  tagNotificationsEnabled: true,
  emailNotificationsEnabled: true,
  allowDirectMessages: true,
  subscribedToNewsletter: false,
};

const NOTIFICATION_ROWS: { key: keyof NotificationSettings; label: string; Icon: LucideIcon }[] = [
  { key: 'pushNotificationsEnabled', label: 'Push notifications', Icon: Bell },
  { key: 'connectionNotificationsEnabled', label: 'Connected', Icon: Users },
  { key: 'tagNotificationsEnabled', label: 'Tagged', Icon: AtSign },
  { key: 'emailNotificationsEnabled', label: 'Email notifications', Icon: Mail },
  { key: 'allowDirectMessages', label: 'Direct messages', Icon: MessageCircle },
  { key: 'subscribedToNewsletter', label: 'Newsletter', Icon: Newspaper },
];

interface Row {
  label: string;
  Icon: LucideIcon;
  hint?: string;
  danger?: boolean;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Account',
    rows: [
      { label: 'Edit profile', Icon: UserPen },
      { label: 'Email address', Icon: Mail, hint: 'grace@onebody.app' },
      { label: 'Password', Icon: Lock },
    ],
  },
  {
    title: 'Privacy & safety',
    rows: [
      { label: 'Privacy settings', Icon: ShieldCheck },
      { label: 'Invite a friend', Icon: UserPlus },
    ],
  },
  {
    title: 'Support',
    rows: [
      { label: 'Help & FAQs', Icon: CircleHelp },
      { label: 'Delete account', Icon: Trash2, danger: true },
    ],
  },
];

function Toggle({
  on,
  onClick,
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  if (on) {
    return (
      <button
        type="button"
        className="toggle is-on"
        onClick={onClick}
        disabled={disabled}
        role="switch"
        aria-checked="true"
        aria-label="Disable setting"
      >
        <span className="toggle__knob" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="toggle"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked="false"
      aria-label="Enable setting"
    >
      <span className="toggle__knob" />
    </button>
  );
}

export function Settings() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { data: savedSettings } = useApiQuery(() => endpoints.getNotificationSettings(), {
    fallback: NOTIFICATION_DEFAULTS,
  });
  const saveSettings = useApiMutation((next: NotificationSettings) =>
    endpoints.updateNotificationSettings(next),
  );
  const [overrides, setOverrides] = useState<Partial<NotificationSettings>>({});
  const [saving, setSaving] = useState<Partial<Record<keyof NotificationSettings, true>>>({});
  const [saveError, setSaveError] = useState(false);
  const [dark, setDark] = useState(false);

  const notifications: NotificationSettings = {
    ...NOTIFICATION_DEFAULTS,
    ...(savedSettings ?? {}),
    ...overrides,
  };

  async function toggleNotification(key: keyof NotificationSettings) {
    const nextValue = !notifications[key];
    // Send the full settings object so the update never depends on Mongoose stripping undefined.
    const nextSettings: NotificationSettings = { ...notifications, [key]: nextValue };

    setSaveError(false);
    setOverrides((current) => ({ ...current, [key]: nextValue }));
    setSaving((current) => ({ ...current, [key]: true }));

    const result = await saveSettings.mutate(nextSettings);

    setSaving((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    // useApiMutation resolves to undefined on failure — revert the optimistic change.
    if (result === undefined) {
      setOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setSaveError(true);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="settings">
      <PageHeader title="Settings" />

      <section className="settings__group card">
        <h2 className="settings__group-title">Notifications</h2>
        {NOTIFICATION_ROWS.map(({ key, label, Icon }) => (
          <div className="settings__row" key={key}>
            <span className="settings__row-left">
              <span className="settings__row-icon">
                <Icon size={19} />
              </span>
              {label}
            </span>
            <Toggle
              on={notifications[key]}
              onClick={() => toggleNotification(key)}
              disabled={Boolean(saving[key])}
            />
          </div>
        ))}
        {saveError ? (
          <p className="settings__error" role="alert">
            Couldn’t save that change. Check your connection and try again.
          </p>
        ) : null}
      </section>

      <section className="settings__group card">
        <h2 className="settings__group-title">Preferences</h2>
        <div className="settings__row">
          <span className="settings__row-left">
            <span className="settings__row-icon">
              <Moon size={19} />
            </span>
            Dark mode
          </span>
          <Toggle on={dark} onClick={() => setDark((v) => !v)} />
        </div>
      </section>

      {GROUPS.map((g) => (
        <section key={g.title} className="settings__group card">
          <h2 className="settings__group-title">{g.title}</h2>
          {g.rows.map((r) => (
            <button
              type="button"
              key={r.label}
              className={`settings__row settings__row--btn${r.danger ? ' is-danger' : ''}`}
            >
              <span className="settings__row-left">
                <span className="settings__row-icon">
                  <r.Icon size={19} />
                </span>
                {r.label}
              </span>
              <span className="settings__row-right">
                {r.hint ? <span className="settings__hint">{r.hint}</span> : null}
                <ChevronRight size={18} />
              </span>
            </button>
          ))}
        </section>
      ))}

      <button type="button" className="btn btn--outline btn--block settings__signout" onClick={handleSignOut}>
        <LogOut size={18} /> Sign out
      </button>
      <p className="settings__version">One Body Web · v0.1.0</p>
    </div>
  );
}
