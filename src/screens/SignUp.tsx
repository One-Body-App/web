import { Link } from 'react-router-dom';
import { clerkEnabled } from '@/auth/context';
import { AuthLayout } from './AuthLayout';
import { ClerkSignUp } from './auth/ClerkSignUp';
import { DemoAuth } from './auth/DemoAuth';

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
      {clerkEnabled ? <ClerkSignUp /> : <DemoAuth mode="sign-up" />}
    </AuthLayout>
  );
}
