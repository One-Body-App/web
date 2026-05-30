import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { Compass, Search } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/auth/context';
import { getCachedIntroAvatars, INTRO_AVATAR_COUNT } from '@/api/introAvatars';
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

// Bundled fallbacks for null slots returned by the intro-avatars endpoint.
// Order is significant — slot N uses index N of this array.
const FALLBACK_AVATARS: readonly string[] = [
  '/brand/avatar1.png',
  '/brand/avatar3.png',
  '/brand/avatar4.png',
  '/brand/avatar5.png',
];

export function Intro() {
  const navigate = useNavigate();
  const { clerkEnabled } = useAuth();
  // 4 slots that mirror the mobile intro avatars exactly. CDN URLs from the
  // backend get loaded into these; if a slot is null OR its image errors out,
  // the matching bundled face stays visible.
  const [remoteAvatars, setRemoteAvatars] = useState<(string | null)[]>(() =>
    Array(INTRO_AVATAR_COUNT).fill(null)
  );
  const [avatarLoadErrored, setAvatarLoadErrored] = useState<boolean[]>(() =>
    Array(INTRO_AVATAR_COUNT).fill(false)
  );

  useEffect(() => {
    let active = true;
    getCachedIntroAvatars()
      .then((urls) => {
        if (!active) return;
        setRemoteAvatars(urls);
        setAvatarLoadErrored(Array(INTRO_AVATAR_COUNT).fill(false));
      })
      .catch(() => {
        // Network silently fell over - we keep the bundled fallbacks.
      });
    return () => {
      active = false;
    };
  }, []);

  function avatarSrcForSlot(slot: number): string {
    const remote = remoteAvatars[slot];
    if (remote && !avatarLoadErrored[slot]) return remote;
    return FALLBACK_AVATARS[slot] ?? FALLBACK_AVATARS[0];
  }

  function handleAvatarError(slot: number) {
    setAvatarLoadErrored((current) => {
      if (current[slot]) return current;
      const next = current.slice();
      next[slot] = true;
      return next;
    });
  }

  return (
    <div className="intro">
      <div className="intro__bg" aria-hidden />

      <header className="intro__topbar">
        <Logo size={28} withWordmark />
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
                <PulseAvatar
                  src={avatarSrcForSlot(0)}
                  delay={0}
                  onError={() => handleAvatarError(0)}
                />
              </OrbitItem>
              <OrbitItem trackSize={OUTER} radius={OUTER / 2} angle={205} size={48} direction={1}>
                <PulseAvatar
                  src={avatarSrcForSlot(1)}
                  delay={0.8}
                  onError={() => handleAvatarError(1)}
                />
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
                <PulseAvatar
                  src={avatarSrcForSlot(2)}
                  delay={0.4}
                  onError={() => handleAvatarError(2)}
                />
              </OrbitItem>
              <OrbitItem trackSize={INNER} radius={INNER / 2} angle={310} size={38} direction={-1}>
                <PulseAvatar
                  src={avatarSrcForSlot(3)}
                  delay={1.1}
                  onError={() => handleAvatarError(3)}
                />
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
            <button type="button" className="btn btn--brand btn--lg btn--block" onClick={() => navigate('/sign-up')}>
              Join the Family
            </button>
            <button type="button" className="btn btn--outline btn--lg btn--block" onClick={() => navigate('/sign-in')}>
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

function PulseAvatar({
  src,
  delay,
  onError,
}: {
  src: string;
  delay: number;
  onError?: () => void;
}) {
  return (
    <motion.img
      src={src}
      alt=""
      className="orbit__avatar"
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay }}
      onError={onError}
    />
  );
}
