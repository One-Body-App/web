import { useOnboarding } from '../OnboardingContext';

/** Mirrors mobile's OnboardingOrganizationSubtype ("Select your organization subtype"). */
export function OrgSubtypeStep() {
  const { selectedGroup, selectedOrganizationType, setSelectedOrganizationType } = useOnboarding();

  if (!selectedGroup) {
    return <p className="onboarding-hint">Choose an organization type first.</p>;
  }

  return (
    <div className="onboarding-subtypes">
      {selectedGroup.subtypes.map((item) => (
        <button
          type="button"
          key={item.organizationTypeId}
          className={`onboarding-option${selectedOrganizationType === item.organizationTypeId ? ' is-selected' : ''}`}
          onClick={() => setSelectedOrganizationType(item.organizationTypeId)}
          {...{
            'aria-pressed': selectedOrganizationType === item.organizationTypeId ? 'true' : 'false',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
