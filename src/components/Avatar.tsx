import { BadgeCheck, User } from 'lucide-react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: number;
  ring?: boolean;
  verified?: boolean;
}

// `/brand/avatar1.png` is only ever used as the "no avatar" fallback sentinel
// (never a real avatar), so treat it — along with blanks and the API's
// no-image.png — as "no image" and draw an initials placeholder instead.
const FALLBACK_SRC = '/brand/avatar1.png';

// Generational suffixes shouldn't count toward initials ("Carl Murray Jr." -> "CM").
const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
function initialsOf(name: string): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !NAME_SUFFIX.test(w));
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable, muted hue per name so different users read as distinct without rainbow noise.
function hueFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 360;
  return hash;
}

export function Avatar({ src, alt, size = 44, ring = false, verified = false }: AvatarProps) {
  const safeAlt = alt == null ? '' : String(alt);
  const hasImage =
    typeof src === 'string' && src.trim() !== '' && src !== FALLBACK_SRC && !/no-image/i.test(src);
  const ringStyle = ring
    ? { boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--accent)' }
    : null;
  const initials = initialsOf(safeAlt);

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
          aria-label={safeAlt}
          style={{
            display: 'grid',
            placeItems: 'center',
            width: size,
            height: size,
            borderRadius: '50%',
            background: `hsl(${hueFromString(safeAlt || 'one body')}, 30%, 47%)`,
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: Math.max(10, Math.round(size * 0.4)),
            lineHeight: 1,
            userSelect: 'none',
            ...(ringStyle ?? {}),
          }}
        >
          {initials || <User size={Math.round(size * 0.55)} strokeWidth={2} />}
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
