import { HeartHandshake } from 'lucide-react';

/** Onboarding welcome. Mirrors mobile's OnboardingIntro copy. */
export function IntroStep() {
  return (
    <div className="onboarding-intro">
      <div className="onboarding-intro__art" aria-hidden>
        <HeartHandshake size={44} />
      </div>
      <p className="onboarding-intro__lead">
        A few quick questions help us connect you with your community and personalize your feeds.
        This should take about a minute to complete.
      </p>
    </div>
  );
}
