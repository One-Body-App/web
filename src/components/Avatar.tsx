import { BadgeCheck } from 'lucide-react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: number;
  ring?: boolean;
  verified?: boolean;
}

export function Avatar({ src, alt, size = 44, ring = false, verified = false }: AvatarProps) {
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
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        className="avatar"
        style={
          ring
            ? { boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--accent)', width: size, height: size }
            : { width: size, height: size }
        }
      />
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
