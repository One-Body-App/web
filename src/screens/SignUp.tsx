import { Link } from 'react-router-dom';
import { clerkConfigError, clerkEnabled } from '@/auth/context';
import { AuthLayout } from './AuthLayout';
import { ClerkSignUp } from './auth/ClerkSignUp';
import { DemoAuth } from './auth/DemoAuth';
import { AuthError } from '@/components/auth/AuthControls';

export function SignUpScreen() {
  return (
    <AuthLayout
      title="Join the family"
      subtitle="Create your account and connect with the global church."
      footer={
        <>
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </>
      }
    >
      {clerkConfigError ? (
        <AuthError message={clerkConfigError} />
      ) : clerkEnabled ? (
        <ClerkSignUp />
      ) : (
        <DemoAuth mode="sign-up" />
      )}
    </AuthLayout>
  );
}
