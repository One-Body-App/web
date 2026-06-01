import { useOnboarding } from '../OnboardingContext';

/** Mirrors mobile's OnboardingInterests (min 3 required). */
export function InterestsStep() {
  const { interests, selectedInterests, toggleInterest } = useOnboarding();
  const remaining = Math.max(0, 3 - selectedInterests.length);

  return (
    <>
      <p className="onboarding-hint">
        {remaining > 0
          ? `Select ${remaining} more to continue (${selectedInterests.length}/3).`
          : `${selectedInterests.length} selected.`}
      </p>
      <div className="onboarding-list">
        {interests.map((interest) => (
          <button
            type="button"
            key={interest._id}
            className={`onboarding-chip${selectedInterests.includes(interest._id) ? ' is-selected' : ''}`}
            onClick={() => toggleInterest(interest._id)}
            {...{ 'aria-pressed': selectedInterests.includes(interest._id) ? 'true' : 'false' }}
          >
            {interest.name}
          </button>
        ))}
      </div>
    </>
  );
}
