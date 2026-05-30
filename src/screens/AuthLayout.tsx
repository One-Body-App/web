import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import './AuthLayout.css';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth">
      <span className="auth__orb auth__orb--1" aria-hidden />
      <span className="auth__orb auth__orb--2" aria-hidden />

      <main className="auth__card">
        <Link to="/" className="auth__logo" aria-label="One Body home">
          <Logo size={30} withWordmark />
        </Link>
        <h1 className="auth__title">{title}</h1>
        <p className="auth__subtitle">{subtitle}</p>
        <div className="auth__body">{children}</div>
        <div className="auth__footer">{footer}</div>
      </main>
    </div>
  );
}
