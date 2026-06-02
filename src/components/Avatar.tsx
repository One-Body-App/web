import { BadgeCheck, UserRound } from 'lucide-react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: number;
  ring?: boolean;
  verified?: boolean;
}

// `/brand/avatar1.png` is only ever used as the "no avatar" fallback sentinel
// (never a real avatar), so treat it — along with blanks and the API's
// no-image.png — as "no image" and draw the silhouette placeholder instead.
const FALLBACK_SRC = '/brand/avatar1.png';

// Mirrors the mobile app's FeedAvatar/ProfileFill fallback so web and mobile
// read the same: a teal person silhouette on a light circle with a teal ring.
const FALLBACK_BG = '#f6f6f7';
const FALLBACK_INK = '#126b87';

export function Avatar({ src, alt, size = 44, ring = false, verified = false }: AvatarProps) {
  const safeAlt = alt == null ? '' : String(alt);
  const hasImage =
    typeof src === 'string' && src.trim() !== '' && src !== FALLBACK_SRC && !/no-image/i.test(src);
  const ringStyle = ring
    ? { boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--accent)' }
    : null;

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {hasImage ? (
        <img
          src={src}
          alt={safeAlt}
          width={size}
          height={size}
          loading="lazy"
          className="avatar"
          style={{ width: size, height: size, ...(ringStyle ?? {}) }}
        />
      ) : (
        <span
          role="img"
          aria-label={safeAlt}
          style={{
            display: 'grid',
            placeItems: 'center',
            width: size,
            height: size,
            borderRadius: '50%',
            background: FALLBACK_BG,
            border: `1px solid ${FALLBACK_INK}`,
            color: FALLBACK_INK,
            ...(ringStyle ?? {}),
          }}
        >
          <UserRound size={Math.round(size * 0.48)} strokeWidth={2} />
        </span>
      )}
      {verified ? (
        <BadgeCheck
          size={Math.max(14, size * 0.32)}
          strokeWidth={2.5}
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            color: 'var(--sapphire)',
            background: '#fff',
            borderRadius: '50%',
          }}
          fill="var(--accent)"
        />
      ) : null}
    </span>
  );
}
