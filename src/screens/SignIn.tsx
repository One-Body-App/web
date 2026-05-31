import { Link } from 'react-router-dom';
import { clerkConfigError, clerkEnabled } from '@/auth/context';
import { AuthLayout } from './AuthLayout';
import { ClerkSignIn } from './auth/ClerkSignIn';
import { DemoAuth } from './auth/DemoAuth';
import { AuthError } from '@/components/auth/AuthControls';
import { useAuth } from '@/auth/context';

export function SignInScreen() {
  const { authError } = useAuth();
  const errorMessage = clerkConfigError || authError;

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
      {errorMessage ? (
        <AuthError message={errorMessage} />
      ) : clerkEnabled ? (
        <ClerkSignIn />
      ) : (
        <DemoAuth mode="sign-in" />
      )}
    </AuthLayout>
  );
}
