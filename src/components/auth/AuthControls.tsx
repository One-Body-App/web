import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Users, User } from 'lucide-react';
import './auth-form.css';

/* ----------------------------- Text field ----------------------------- */
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({
  label,
  error,
  id,
  rightSlot,
  ...props
}: FieldProps & { rightSlot?: ReactNode }) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__box">
        <input id={inputId} {...props} />
        {rightSlot ? <span className="field__right">{rightSlot}</span> : null}
      </div>
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}

export function PasswordField({ label, error, id, ...props }: FieldProps) {
  const [show, setShow] = useState(false);
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__box">
        <input id={inputId} type={show ? 'text' : 'password'} {...props} />
        <button
          type="button"
          className="field__toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}

/* ----------------------------- Submit button ----------------------------- */
export function SubmitButton({
  loading,
  children,
  disabled,
  type = 'submit',
  ...props
}: { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className="btn btn--brand btn--block auth-submit"
      disabled={loading || disabled}
      {...props}
    >
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}

/* ----------------------------- Social ----------------------------- */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.3 35.6 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 16 20" aria-hidden fill="currentColor">
      <path d="M13.36 15.6c-.24.56-.53 1.08-.87 1.55-.46.65-.84 1.1-1.13 1.35-.45.42-.94.63-1.46.65-.37 0-.83-.11-1.35-.32-.53-.21-1.02-.32-1.46-.32-.46 0-.96.11-1.5.32-.55.21-.99.32-1.32.33-.5.02-1-.2-1.49-.66-.31-.27-.7-.74-1.18-1.4-.5-.71-.92-1.53-1.24-2.47C.34 13.07.16 12.05.16 11.07c0-1.13.24-2.1.73-2.92a4.3 4.3 0 0 1 1.53-1.55 4.1 4.1 0 0 1 2.06-.58c.4 0 .92.12 1.57.36.65.24 1.06.36 1.25.36.14 0 .6-.14 1.37-.43.73-.26 1.35-.37 1.85-.33 1.37.11 2.4.65 3.08 1.63-1.22.74-1.83 1.78-1.82 3.1.01 1.04.39 1.9 1.13 2.58.34.32.71.57 1.13.74-.09.26-.19.52-.3.76zM10.6.4c0 .84-.31 1.63-.92 2.36-.74.86-1.63 1.36-2.6 1.28a2.6 2.6 0 0 1-.02-.32c0-.8.35-1.67.98-2.38.31-.36.71-.66 1.2-.9.48-.23.94-.36 1.37-.38.01.11.01.22.01.34z" />
    </svg>
  );
}

interface SocialButtonsProps {
  onGoogle: () => void;
  onApple: () => void;
  disabled?: boolean;
  verb?: string;
}

export function SocialButtons({ onGoogle, onApple, disabled, verb = 'Continue' }: SocialButtonsProps) {
  return (
    <div className="auth-social">
      <button type="button" className="auth-social__btn" onClick={onGoogle} disabled={disabled}>
        <GoogleIcon /> {verb} with Google
      </button>
      <button type="button" className="auth-social__btn" onClick={onApple} disabled={disabled}>
        <AppleIcon /> {verb} with Apple
      </button>
    </div>
  );
}

export function AuthDivider({ label = 'or' }: { label?: string }) {
  return <div className="auth-divider">{label}</div>;
}

/* ----------------------------- Alerts ----------------------------- */
export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="auth-alert auth-alert--error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

export function AuthSuccess({ children }: { children: ReactNode }) {
  return (
    <div className="auth-alert auth-alert--success">
      <CheckCircle2 size={18} />
      <span>{children}</span>
    </div>
  );
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="auth-back" onClick={onClick}>
      <ArrowLeft size={16} /> {label}
    </button>
  );
}

/* ----------------------------- Verification code ----------------------------- */
export function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = 6;
  return (
    <div className="code-input">
      {Array.from({ length: digits }).map((_, i) => (
        <input
          key={i}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, digits);
            onChange(next);
            if (ch && e.target.nextElementSibling instanceof HTMLInputElement) {
              e.target.nextElementSibling.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && e.currentTarget.previousElementSibling instanceof HTMLInputElement) {
              e.currentTarget.previousElementSibling.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, digits);
            if (pasted) onChange(pasted);
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------- Account type picker ----------------------------- */
export type AccountType = 'individual' | 'organization';

const ACCOUNT_TYPES: { key: AccountType; title: string; desc: string; Icon: typeof User }[] = [
  {
    key: 'individual',
    title: 'Individual',
    desc: 'For believers, leaders, and creators who want to connect, pray, and grow together.',
    Icon: User,
  },
  {
    key: 'organization',
    title: 'Organization',
    desc: 'For churches, ministries, nonprofits, and Christian businesses managing pages, events, and community.',
    Icon: Users,
  },
];

export function AccountTypePicker({
  value,
  onChange,
}: {
  value: AccountType | null;
  onChange: (v: AccountType) => void;
}) {
  return (
    <div className="acct-picker">
      {ACCOUNT_TYPES.map(({ key, title, desc, Icon }) => (
        <button
          key={key}
          type="button"
          className={`acct-card${value === key ? ' is-active' : ''}`}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
        >
          <span className="acct-card__icon">
            <Icon size={22} />
          </span>
          <span className="acct-card__body">
            <strong>{title}</strong>
            <span>{desc}</span>
          </span>
          <span className="acct-card__radio">
            <span />
          </span>
        </button>
      ))}
    </div>
  );
}
