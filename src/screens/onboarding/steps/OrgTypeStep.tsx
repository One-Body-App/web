import { useOnboarding } from '../OnboardingContext';

/** Mirrors mobile's OnboardingOrganizationType ("What type of organization are you?"). */
export function OrgTypeStep() {
  const { organizationGroups, selectedCategory, setSelectedCategory } = useOnboarding();
  return (
    <div className="onboarding-list">
      {organizationGroups.map((group) => (
        <button
          type="button"
          key={group.value}
          className={`onboarding-chip${selectedCategory === group.value ? ' is-selected' : ''}`}
          onClick={() => setSelectedCategory(group.value)}
          {...{ 'aria-pressed': selectedCategory === group.value ? 'true' : 'false' }}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}
