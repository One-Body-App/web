import { TextField } from '@/components/auth/AuthControls';
import { useOnboarding } from '../OnboardingContext';

/** Mirrors mobile's OnboardingOrganizationInfo ("Tell us about your organization"). */
export function OrgInfoStep() {
  const {
    organizationName,
    setOrganizationName,
    contactName,
    setContactName,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    city,
    setCity,
  } = useOnboarding();

  return (
    <>
      <TextField
        label="Organization name"
        value={organizationName}
        onChange={(event) => setOrganizationName(event.target.value)}
        required
      />
      <TextField
        label="Primary contact"
        value={contactName}
        onChange={(event) => setContactName(event.target.value)}
        required
      />
      <TextField
        label="Contact email"
        type="email"
        value={contactEmail}
        onChange={(event) => setContactEmail(event.target.value)}
        required
      />
      <TextField
        label="Contact phone"
        value={contactPhone}
        onChange={(event) => setContactPhone(event.target.value)}
        placeholder="Optional"
      />
      <TextField
        label="City"
        placeholder="City, State"
        value={city}
        onChange={(event) => setCity(event.target.value)}
        required
      />
    </>
  );
}
