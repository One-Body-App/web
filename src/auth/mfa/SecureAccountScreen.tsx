import { TaskSetupMFA } from '@clerk/clerk-react';
import { ShieldCheck } from 'lucide-react';
import { StepLayout } from '@/screens/onboarding/StepLayout';
import './secure-account.css';

export function SecureAccountScreen() {
  return (
    <StepLayout
      icon={<ShieldCheck size={26} />}
      eyebrow="Account security"
      title="Secure your account"
      subtitle="Finish multi-factor setup with Clerk to continue into One Body."
    >
      <div className="secure-account__clerk-task">
        <TaskSetupMFA redirectUrlComplete="/home" />
      </div>
    </StepLayout>
  );
}
