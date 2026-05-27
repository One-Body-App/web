import { Logo } from './Logo';
import './Splash.css';

export function Splash({ label }: { label?: string }) {
  return (
    <div className="splash">
      <div className="splash__mark">
        <Logo size={52} />
        <span className="splash__ring" />
      </div>
      {label ? <p className="splash__label">{label}</p> : null}
    </div>
  );
}
