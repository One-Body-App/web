import { Link } from 'react-router-dom';
import { clerkConfigError, clerkEnabled } from '@/auth/context';
import { AuthLayout } from './AuthLayout';
import { ClerkSignIn } from './auth/ClerkSignIn';
import { DemoAuth } from './auth/DemoAuth';
import { AuthError } from '@/components/auth/AuthControls';

export function SignInScreen() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to rejoin the family."
      footer={
        <>
          New to One Body? <Link to="/sign-up">Join the family</Link>
        </>
      }
    >
      {clerkConfigError ? (
        <AuthError message={clerkConfigError} />
      ) : clerkEnabled ? (
        <ClerkSignIn />
      ) : (
        <DemoAuth mode="sign-in" />
      )}
    </AuthLayout>
  );
}
