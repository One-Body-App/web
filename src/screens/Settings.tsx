import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Lock,
  LogOut,
  Mail,
  Moon,
  ShieldCheck,
  Trash2,
  UserPen,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/auth/context';
import './Settings.css';

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

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  if (on) {
    return (
      <button
        type="button"
        className="toggle is-on"
        onClick={onClick}
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
  const [push, setPush] = useState(true);
  const [dark, setDark] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="settings">
      <PageHeader title="Settings" />

      <section className="settings__group card">
        <h2 className="settings__group-title">Preferences</h2>
        <div className="settings__row">
          <span className="settings__row-left">
            <span className="settings__row-icon">
              <Bell size={19} />
            </span>
            Push notifications
          </span>
          <Toggle on={push} onClick={() => setPush((v) => !v)} />
        </div>
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
