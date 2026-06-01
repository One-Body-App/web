import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { TextField } from '@/components/auth/AuthControls';
import { reverseGeocode } from '@/api/connect';
import { useOnboarding } from '../OnboardingContext';

/** Mirrors mobile's OnboardingLocation ("Where do you call home?"). Optional. */
export function LocationStep() {
  const { city, setCity } = useOnboarding();
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All location work is event-driven (no useEffect, per project rule).
  const handleDetect = () => {
    if (!navigator.geolocation) {
      setError('Location isn’t available on this device — enter your city manually.');
      return;
    }
    setError(null);
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const label = await reverseGeocode(coords.longitude, coords.latitude);
          if (label) {
            setCity(label);
          } else {
            setError('Couldn’t find your city — enter it manually.');
          }
        } catch {
          setError('Couldn’t find your city — enter it manually.');
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setError('Couldn’t detect your location — enter your city manually.');
        setDetecting(false);
      },
      { timeout: 10000 },
    );
  };

  return (
    <>
      <TextField
        label="City"
        placeholder="City, State"
        value={city}
        onChange={(event) => setCity(event.target.value)}
        autoComplete="address-level2"
        error={error ?? undefined}
        rightSlot={
          <button
            type="button"
            className="field__locate"
            onClick={handleDetect}
            disabled={detecting}
            aria-label="Use my location"
            title="Use my location"
          >
            {detecting ? <span className="spinner" /> : <LocateFixed size={18} />}
          </button>
        }
      />
      <p className="onboarding-hint">
        We use this only to connect you with your local community. You can skip it for now.
      </p>
    </>
  );
}
