/**
 * Slim step progress bar used across the post-email flow (MFA + onboarding).
 * `current` is 1-based. Renders a filled track plus a "Step X of Y" label.
 */
export function ProgressIndicator({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 1), safeTotal);
  const pct = Math.round((safeCurrent / safeTotal) * 100);

  return (
    <div className="step-progress">
      <div
        className="step-progress__track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCurrent}
        aria-label={`Step ${safeCurrent} of ${safeTotal}`}
      >
        <span className="step-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="step-progress__label">
        Step {safeCurrent} of {safeTotal}
      </span>
    </div>
  );
}
