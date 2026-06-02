import { useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { AuthError } from '@/components/auth/AuthControls';
import { InfoModal } from '@/components/InfoModal';
import { ProgressIndicator } from './ProgressIndicator';
import './onboarding.css';

interface StepLayoutProps {
  /** 1-based progress position. Omit to hide the progress bar (e.g. intro). */
  current?: number;
  total?: number;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Branded icon mark shown above the title. */
  icon?: ReactNode;
  /** Inline error rendered above the body. */
  error?: string | null;
  children: ReactNode;
  /** Sticky footer content (typically Back / Continue actions). */
  footer?: ReactNode;
  /**
   * Optional "Why are we asking this?" explanation. When set, a sapphire help
   * button renders under the body and opens an InfoModal with this content.
   */
  reason?: ReactNode;
}

/**
 * Full-screen frame shared by every post-email step (passkey MFA + onboarding).
 * Mirrors the AccountGate aesthetic (hero gradient, glass panel, Rubik headings)
 * but as a real screen with a progress bar and a sticky action footer.
 */
export function StepLayout({
  current,
  total,
  eyebrow,
  title,
  subtitle,
  icon,
  error,
  children,
  footer,
  reason,
}: StepLayoutProps) {
  const showProgress = typeof current === 'number' && typeof total === 'number';
  const [showReason, setShowReason] = useState(false);

  return (
    <div className="step-screen">
      <main className="step-screen__panel" aria-live="polite">
        {showProgress ? <ProgressIndicator current={current} total={total} /> : null}

        <header className="step-screen__head">
          {icon ? <div className="step-screen__mark">{icon}</div> : null}
          {eyebrow ? <span className="step-screen__eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="step-screen__subtitle">{subtitle}</p> : null}
        </header>

        {error ? <AuthError message={error} /> : null}

        <div className="step-screen__body">
          {children}
          {reason ? (
            <button
              type="button"
              className="step-screen__reason"
              aria-haspopup="dialog"
              onClick={() => setShowReason(true)}
            >
              <CircleHelp size={16} />
              Why are we asking this?
            </button>
          ) : null}
        </div>

        {footer ? <footer className="step-screen__footer">{footer}</footer> : null}
      </main>

      {reason && showReason ? (
        <InfoModal onClose={() => setShowReason(false)}>{reason}</InfoModal>
      ) : null}
    </div>
  );
}
