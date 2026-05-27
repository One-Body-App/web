interface LogoProps {
  size?: number;
  tone?: 'brand' | 'white' | 'ink';
  withWordmark?: boolean;
  className?: string;
}

const OB_PATH_1 =
  'M5.8691 10.8436V6.01759L13.3781 5.97883V10.8985H18.225C18.6466 10.8985 19.0344 10.872 19.3873 10.8197V16.3816C19.3446 16.3809 19.3013 16.3803 19.258 16.3803H13.3781V21.5804H13.3882V27.8686H9.83278C8.78136 27.8686 7.77324 27.4447 7.03005 26.6906C6.28686 25.9366 5.8691 24.9138 5.8691 23.847V16.3641H2.77533C2.01622 16.3641 1.28768 16.0579 0.750828 15.5132C0.213337 14.9678 -0.0878906 14.2293 -0.0878906 13.4585V10.8436H5.8691Z';
const OB_PATH_2 =
  'M14.3979 -0.0654297H19.9455C23.3853 -0.0654297 25.8088 0.807053 27.4115 2.43373C28.5061 3.54468 29.1703 5.01238 29.1703 6.91695V6.99644C29.1703 10.2097 27.3727 12.1137 24.9492 13.1852C28.2712 14.2961 30.382 16.2001 30.382 19.9692V20.048C30.382 24.8091 26.5513 27.7051 20.0238 27.7051H14.3979V24.6642C14.3979 23.8292 14.725 23.0286 15.3065 22.4384C15.8879 21.8477 16.6767 21.5164 17.4994 21.5164H19.1642C21.4699 21.5164 22.7988 20.6038 22.7988 18.9771V18.8977C22.7988 17.6557 22.0025 16.7635 20.3007 16.4882V10.6333C21.1898 10.2511 21.6654 9.57063 21.6654 8.58305V8.50356C21.6654 6.99644 20.4931 6.12333 18.2256 6.12333H14.3979V-0.0654297Z';

export function Logo({ size = 32, tone = 'brand', withWordmark = false, className }: LogoProps) {
  const gradientId = `ob-grad-${tone}`;
  const fill = tone === 'white' ? '#ffffff' : tone === 'ink' ? '#032f3c' : `url(#${gradientId})`;

  const mark = (
    <svg
      width={size}
      height={(size * 28) / 31}
      viewBox="0 0 31 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={withWordmark ? true : undefined}
      role={withWordmark ? undefined : 'img'}
      aria-label={withWordmark ? undefined : 'One Body'}
    >
      <defs>
        <linearGradient id={gradientId} x1="15" y1="0" x2="15" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0E5469" />
          <stop offset="1" stopColor="#032F3C" />
        </linearGradient>
      </defs>
      <path d={OB_PATH_1} fill={fill} />
      <path d={OB_PATH_2} fill={fill} />
    </svg>
  );

  if (!withWordmark) {
    return <span className={className}>{mark}</span>;
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}
    >
      {mark}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.62,
          letterSpacing: '-0.02em',
          color: tone === 'white' ? '#fff' : 'var(--brand)',
        }}
      >
        One Body
      </span>
    </span>
  );
}
