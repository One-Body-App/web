import { useOnboarding } from '../OnboardingContext';

/** Mirrors mobile's OnboardingDateOfBirth ("What's your birth year?"). */
export function BirthYearStep() {
  const { years, year, setYear } = useOnboarding();
  return (
    <label className="field">
      <span className="field__label">Birth year</span>
      <span className="field__box">
        <select value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
