import type { ReactNode } from 'react';
import { AuthError } from '@/components/auth/AuthControls';
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
}: StepLayoutProps) {
  const showProgress = typeof current === 'number' && typeof total === 'number';

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

        <div className="step-screen__body">{children}</div>

        {footer ? <footer className="step-screen__footer">{footer}</footer> : null}
      </main>
    </div>
  );
}
