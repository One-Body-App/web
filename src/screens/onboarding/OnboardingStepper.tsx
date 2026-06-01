import { type ComponentType } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Splash } from '@/components/Splash';
import { SubmitButton } from '@/components/auth/AuthControls';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import { StepLayout } from './StepLayout';
import { IntroStep } from './steps/IntroStep';
import { BirthYearStep } from './steps/BirthYearStep';
import { LocationStep } from './steps/LocationStep';
import { InterestsStep } from './steps/InterestsStep';
import { FollowStep } from './steps/FollowStep';
import { OrgTypeStep } from './steps/OrgTypeStep';
import { OrgSubtypeStep } from './steps/OrgSubtypeStep';
import { OrgInfoStep } from './steps/OrgInfoStep';
import { ChurchTypeStep } from './steps/ChurchTypeStep';
import { ChurchAttendanceStep } from './steps/ChurchAttendanceStep';

type StepId =
  | 'intro'
  | 'church-type'
  | 'attendance'
  | 'birth-year'
  | 'location'
  | 'interests'
  | 'follow'
  | 'org-type'
  | 'org-subtype'
  | 'org-info';

type Ctx = ReturnType<typeof useOnboarding>;

interface StepConfig {
  title: string;
  subtitle?: string;
  Component: ComponentType;
  /** Continue is blocked until this returns true. Omit for always-passable steps. */
  isComplete?: (ctx: Ctx) => boolean;
  /** Skip is allowed (button reads "Skip" until the user provides input). */
  optional?: boolean;
  /** Overrides the Continue label (e.g. the intro CTA). */
  continueLabel?: string;
  /** Steps that read interests / suggested users / org types need options loaded. */
  needsOptions?: boolean;
}

const STEP_CONFIG: Record<StepId, StepConfig> = {
  intro: {
    title: "Let's Get to Know You",
    subtitle: 'This should take about a minute to complete.',
    Component: IntroStep,
    continueLabel: 'Get started',
  },
  // --- Hidden steps (built, not wired into the active arrays) ---
  'church-type': {
    title: 'What type of church do you attend?',
    Component: ChurchTypeStep,
    optional: true,
  },
  attendance: {
    title: 'How often do you attend Church?',
    subtitle: 'Select the rate at which you go to church.',
    Component: ChurchAttendanceStep,
    optional: true,
  },
  // --- Active individual steps ---
  'birth-year': {
    title: "What's your birth year?",
    Component: BirthYearStep,
  },
  location: {
    title: 'Where do you call home?',
    subtitle: 'To connect you with your local community, we just need your city.',
    Component: LocationStep,
    optional: true,
  },
  interests: {
    title: 'Choose your interests',
    subtitle: 'Select a minimum of 3 interests to personalize your feeds.',
    Component: InterestsStep,
    isComplete: (ctx) => ctx.selectedInterests.length >= 3,
    needsOptions: true,
  },
  follow: {
    title: 'Find your people',
    subtitle: 'Select ministries and creators to connect with, or skip for now.',
    Component: FollowStep,
    optional: true,
    needsOptions: true,
  },
  // --- Active organization steps ---
  'org-type': {
    title: 'What type of organization are you?',
    Component: OrgTypeStep,
    isComplete: (ctx) => Boolean(ctx.selectedCategory),
    needsOptions: true,
  },
  'org-subtype': {
    title: 'Select your organization subtype',
    Component: OrgSubtypeStep,
    isComplete: (ctx) => Boolean(ctx.selectedSubtype),
    needsOptions: true,
  },
  'org-info': {
    title: 'Tell us about your organization',
    Component: OrgInfoStep,
    isComplete: (ctx) =>
      Boolean(
        ctx.organizationName.trim() &&
          ctx.contactName.trim() &&
          ctx.contactEmail.trim() &&
          ctx.city.trim(),
      ),
  },
};

const INDIVIDUAL_STEPS: StepId[] = ['intro', 'birth-year', 'location', 'interests', 'follow'];
const ORG_STEPS: StepId[] = ['intro', 'org-type', 'org-subtype', 'org-info', 'interests', 'follow'];
// Hidden — built but not wired, mirroring mobile's OnboardingStack.tsx where the
// church screens exist as files but are not registered. To re-enable, splice
// 'church-type' and 'attendance' into INDIVIDUAL_STEPS after 'intro'.
// const HIDDEN_STEPS: StepId[] = ['church-type', 'attendance'];

function OnboardingFlow() {
  const ctx = useOnboarding();
  const navigate = useNavigate();
  const params = useParams<{ step: string }>();

  const steps = ctx.isOrganization ? ORG_STEPS : INDIVIDUAL_STEPS;
  const requestedStep = params.step as StepId | undefined;
  const index = requestedStep ? steps.indexOf(requestedStep) : -1;

  // Bare /onboarding or an unknown/out-of-branch step -> first step.
  if (index === -1) {
    return <Navigate to={`/onboarding/${steps[0]}`} replace />;
  }

  const stepId = steps[index];
  const config = STEP_CONFIG[stepId];
  const isFinal = index === steps.length - 1;
  const complete = config.isComplete ? config.isComplete(ctx) : true;

  const handleBack = () => {
    if (index > 0) navigate(`/onboarding/${steps[index - 1]}`);
  };

  const handleNext = () => {
    ctx.setSubmitError(null);
    if (stepId === 'interests') {
      void ctx.loadSuggestedUsers();
    }
    navigate(`/onboarding/${steps[index + 1]}`);
  };

  const handleSubmit = async () => {
    const ok = await ctx.submitOnboarding();
    if (ok) navigate('/home', { replace: true });
  };

  if (config.needsOptions && ctx.loadingOptions) {
    return <Splash label="Loading onboarding" />;
  }

  if (
    stepId === 'follow' &&
    !ctx.suggestionsReady &&
    !ctx.loadingSuggestions &&
    !ctx.suggestionsError
  ) {
    queueMicrotask(() => void ctx.loadSuggestedUsers());
    return <Splash label="Loading people" />;
  }

  if (stepId === 'follow' && ctx.loadingSuggestions) {
    return <Splash label="Loading people" />;
  }

  // Options failed to load — offer a retry rather than a dead-end step.
  if (config.needsOptions && ctx.optionsError) {
    return (
      <StepLayout
        current={index + 1}
        total={steps.length}
        eyebrow={ctx.isOrganization ? 'Organization setup' : 'Your profile'}
        title={config.title}
        subtitle={config.subtitle}
        error={ctx.optionsError}
      >
        <SubmitButton type="button" onClick={() => void ctx.loadOptions()}>
          Try again
        </SubmitButton>
      </StepLayout>
    );
  }

  if (stepId === 'follow' && ctx.suggestionsError) {
    return (
      <StepLayout
        current={index + 1}
        total={steps.length}
        eyebrow={ctx.isOrganization ? 'Organization setup' : 'Your profile'}
        title={config.title}
        subtitle={config.subtitle}
        error={ctx.suggestionsError}
      >
        <SubmitButton type="button" onClick={() => void ctx.loadSuggestedUsers()}>
          Try again
        </SubmitButton>
      </StepLayout>
    );
  }

  const continueDisabled = !isFinal && !config.optional && !complete;
  const continueLabel =
    config.continueLabel ?? (config.optional && !complete ? 'Skip' : 'Continue');

  const footer = (
    <>
      {index > 0 ? (
        <button type="button" className="btn btn--outline step-screen__back" onClick={handleBack}>
          Back
        </button>
      ) : null}
      {isFinal ? (
        <SubmitButton loading={ctx.submitting} onClick={handleSubmit}>
          {ctx.selectedFollows.length > 0 ? 'Complete onboarding' : 'Skip and finish'}
        </SubmitButton>
      ) : (
        <SubmitButton type="button" onClick={handleNext} disabled={continueDisabled}>
          {continueLabel}
        </SubmitButton>
      )}
    </>
  );

  const Body = config.Component;

  return (
    <StepLayout
      current={index + 1}
      total={steps.length}
      eyebrow={ctx.isOrganization ? 'Organization setup' : 'Your profile'}
      title={config.title}
      subtitle={config.subtitle}
      error={ctx.submitError}
      footer={footer}
    >
      <Body />
    </StepLayout>
  );
}

/** Route element for /onboarding/:step. Provides the answer store, then renders the step. */
export function OnboardingStepper() {
  return (
    <OnboardingProvider>
      <OnboardingFlow />
    </OnboardingProvider>
  );
}
