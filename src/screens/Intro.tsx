import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Compass, Search } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/auth/context';
import './Intro.css';

const SPIN = 44; // seconds per full revolution

/** Places a child on a circular orbit via computed coordinates, then
 *  counter-rotates it so its content stays upright while the track spins. */
function OrbitItem({
  trackSize,
  radius,
  angle,
  size,
  direction,
  children,
}: {
  trackSize: number;
  radius: number;
  angle: number;
  size: number;
  direction: 1 | -1;
  children: ReactNode;
}) {
  const rad = (angle * Math.PI) / 180;
  const x = trackSize / 2 + radius * Math.sin(rad);
  const y = trackSize / 2 - radius * Math.cos(rad);
  return (
    <motion.div
      className="orbit__item"
      style={{ left: x, top: y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      animate={{ rotate: -360 * direction }}
      transition={{ duration: SPIN, repeat: Infinity, ease: 'linear' }}
    >
      {children}
    </motion.div>
  );
}

const OUTER = 340;
const INNER = 232;

export function Intro() {
  const navigate = useNavigate();
  const { clerkEnabled } = useAuth();

  return (
    <div className="intro">
      <div className="intro__bg" aria-hidden />

      <header className="intro__topbar">
        <Logo size={28} withWordmark />
        <Link to="/sign-in" className="btn btn--ghost btn--sm">
          Sign in
        </Link>
      </header>

      <div className="intro__grid">
        {/* ---------------- Hero orbit ---------------- */}
        <motion.div
          className="intro__hero"
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="orbit">
            <span className="orbit__ring orbit__ring--1" />
            <span className="orbit__ring orbit__ring--2" />
            <span className="orbit__ring orbit__ring--3" />

            <motion.div
              className="orbit__sun"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Logo size={60} tone="brand" />
            </motion.div>

            {/* Outer track — clockwise */}
            <motion.div
              className="orbit__track"
              style={{ width: OUTER, height: OUTER, marginLeft: -OUTER / 2, marginTop: -OUTER / 2 }}
              animate={{ rotate: 360 }}
              transition={{ duration: SPIN, repeat: Infinity, ease: 'linear' }}
            >
              <OrbitItem trackSize={OUTER} radius={OUTER / 2} angle={22} size={58} direction={1}>
                <PulseAvatar src="/brand/avatar1.png" delay={0} />
              </OrbitItem>
              <OrbitItem trackSize={OUTER} radius={OUTER / 2} angle={205} size={48} direction={1}>
                <PulseAvatar src="/brand/avatar3.png" delay={0.8} />
              </OrbitItem>
              <OrbitItem trackSize={OUTER} radius={OUTER / 2} angle={110} size={40} direction={1}>
                <span className="orbit__icon">
                  <Compass size={18} />
                </span>
              </OrbitItem>
            </motion.div>

            {/* Inner track — counter-clockwise */}
            <motion.div
              className="orbit__track"
              style={{ width: INNER, height: INNER, marginLeft: -INNER / 2, marginTop: -INNER / 2 }}
              animate={{ rotate: -360 }}
              transition={{ duration: SPIN, repeat: Infinity, ease: 'linear' }}
            >
              <OrbitItem trackSize={INNER} radius={INNER / 2} angle={140} size={44} direction={-1}>
                <PulseAvatar src="/brand/avatar4.png" delay={0.4} />
              </OrbitItem>
              <OrbitItem trackSize={INNER} radius={INNER / 2} angle={310} size={38} direction={-1}>
                <PulseAvatar src="/brand/avatar5.png" delay={1.1} />
              </OrbitItem>
              <OrbitItem trackSize={INNER} radius={INNER / 2} angle={30} size={36} direction={-1}>
                <span className="orbit__icon orbit__icon--accent">
                  <Search size={15} />
                </span>
              </OrbitItem>
            </motion.div>
          </div>
        </motion.div>

        {/* ---------------- Copy + CTAs ---------------- */}
        <motion.div
          className="intro__panel"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="eyebrow">The global church, connected</p>
          <h1 className="intro__title">
            Welcome to <span className="text-grad">One&nbsp;Body</span>
          </h1>
          <p className="intro__sub">
            Join the global community of believers. Discover Christian creators, find local churches,
            and unite in prayer with the Body of Christ worldwide.
          </p>

          <div className="intro__cta">
            <button className="btn btn--brand btn--lg btn--block" onClick={() => navigate('/sign-up')}>
              Join the Family
            </button>
            <button className="btn btn--outline btn--lg btn--block" onClick={() => navigate('/sign-in')}>
              I have an account
            </button>
          </div>

          {!clerkEnabled ? (
            <p className="intro__note">
              <strong>Preview mode.</strong> Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to{' '}
              <code>web/.env.local</code> to enable real Clerk auth.
            </p>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}

function PulseAvatar({ src, delay }: { src: string; delay: number }) {
  return (
    <motion.img
      src={src}
      alt=""
      className="orbit__avatar"
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}
