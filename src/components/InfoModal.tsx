import { useCallback, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './InfoModal.css';

/**
 * Small centered explanatory popup (e.g. onboarding's "Why are we asking this?").
 * Mirrors the no-useEffect modal pattern used by ScriptureModal: a callback ref
 * wires the Escape handler and body-scroll lock, returning its own cleanup.
 */
export function InfoModal({
  title = 'Why are we asking this?',
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const cleanupRef = useRef<(() => void) | null>(null);

  const dialogRef = useCallback(
    (node: HTMLDivElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!node) return;
      node.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKey);
      cleanupRef.current = () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = prevOverflow;
      };
    },
    [onClose],
  );

  return (
    <div className="info-modal__scrim" onClick={onClose} role="presentation">
      <div
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="info-modal__head">
          <h2 className="info-modal__title">{title}</h2>
          <button type="button" className="info-modal__close" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="info-modal__body">{children}</div>
      </div>
    </div>
  );
}

export default InfoModal;
