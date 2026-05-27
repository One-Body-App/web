import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from '@/auth/context';
import './ui.css';

/** Sticky header for a content screen. */
export function PageHeader({
  title,
  subtitle,
  action,
  hideOnMobile,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Hide the header on mobile/tablet (<900px) — e.g. Home, where the top bar already gives context. */
  hideOnMobile?: boolean;
}) {
  return (
    <header className={`page-header glass${hideOnMobile ? ' page-header--mobile-hidden' : ''}`}>
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  );
}

/** Pill segmented control used for feed tabs / filters. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          className={`segmented__item${value === o.key ? ' is-active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "What's on your heart?" entry that opens the composer. */
export function ComposerPrompt() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <button className="composer-prompt card" onClick={() => navigate('/post/new')}>
      <Avatar src={user.imageUrl} alt={user.fullName} size={44} />
      <span>What’s on your heart, {user.firstName}?</span>
      <span className="composer-prompt__cta">Post</span>
    </button>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
