import { useOnboarding } from '../OnboardingContext';

/**
 * Mirrors mobile's OnboardingChurchAttend ("How often do you attend Church?").
 * Options are a local static list, exactly like mobile.
 *
 * HIDDEN by default — see ChurchTypeStep for the rationale.
 */
const ATTENDANCE_OPTIONS = [
  'Weekly',
  '2-3 times a month',
  'Monthly',
  'Special occasions',
  "I don't attend",
];

export function ChurchAttendanceStep() {
  const { attendance, setAttendance } = useOnboarding();
  return (
    <div className="onboarding-radios">
      {ATTENDANCE_OPTIONS.map((option) => {
        const selected = attendance === option;
        return (
          <button
            type="button"
            key={option}
            className={`onboarding-radio${selected ? ' is-selected' : ''}`}
            onClick={() => setAttendance(option)}
            {...{ 'aria-pressed': selected ? 'true' : 'false' }}
          >
            <span className="onboarding-radio__dot" aria-hidden />
            {option}
          </button>
        );
      })}
    </div>
  );
}
