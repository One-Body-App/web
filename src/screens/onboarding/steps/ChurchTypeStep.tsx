import { useCallback, useRef, useState } from 'react';
import { endpoints, type ChurchType } from '@/api/endpoints';
import { Splash } from '@/components/Splash';
import { AuthError } from '@/components/auth/AuthControls';
import { useOnboarding } from '../OnboardingContext';

/**
 * Mirrors mobile's OnboardingChurchType ("What type of church do you attend?").
 *
 * HIDDEN by default — not listed in OnboardingStepper's active step arrays, the
 * same way mobile leaves this screen out of OnboardingStack.tsx. Fully built so
 * re-enabling is a one-line change. Fetches its own list lazily so the live flow
 * never calls global/church-type while the step is hidden.
 */
export function ChurchTypeStep() {
  const { churchTypeId, setChurchTypeId } = useOnboarding();
  const [churchTypes, setChurchTypes] = useState<ChurchType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setChurchTypes(await endpoints.getChurchTypes());
    } catch {
      setError('Unable to load church types.');
    } finally {
      setLoading(false);
    }
  }, []);

  if (!startedRef.current) {
    startedRef.current = true;
    void load();
  }

  if (loading) return <Splash label="Loading" />;

  return (
    <>
      {error ? <AuthError message={error} /> : null}
      <div className="onboarding-list">
        {churchTypes.map((type) => (
          <button
            type="button"
            key={type._id}
            className={`onboarding-chip${churchTypeId === type._id ? ' is-selected' : ''}`}
            onClick={() => setChurchTypeId(type._id)}
            {...{ 'aria-pressed': churchTypeId === type._id ? 'true' : 'false' }}
          >
            {type.name}
          </button>
        ))}
      </div>
    </>
  );
}
