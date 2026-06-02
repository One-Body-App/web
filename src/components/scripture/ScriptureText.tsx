import { Fragment, useState } from 'react';
import type { ScriptureMention } from '../../api/scripture';
import { ScriptureModal } from './ScriptureModal';
import './scripture.css';

/**
 * Renders post body text, replacing any detected scripture references with
 * clickable hyperlinks (#41dbe1) that open the verse modal. Falls back to plain
 * text when there are no mentions, so non-scripture posts render identically to
 * before (no design change).
 *
 * Mentions carry character index ranges into `text`; we slice the string into
 * plain segments + link segments. Ranges are sorted and clamped defensively in
 * case anything is malformed.
 */
export function ScriptureText({
  text,
  mentions,
  posterTranslation,
  className,
  onTextClick,
}: {
  text: string;
  mentions?: ScriptureMention[] | null;
  posterTranslation?: string;
  className?: string;
  /** Passthrough so the body still opens the post when tapped (feed behavior). */
  onTextClick?: () => void;
}) {
  const [active, setActive] = useState<ScriptureMention | null>(null);

  const valid = (mentions ?? [])
    .filter(
      (m) =>
        Number.isFinite(m.startIndex) &&
        Number.isFinite(m.endIndex) &&
        m.startIndex >= 0 &&
        m.endIndex <= text.length &&
        m.endIndex > m.startIndex,
    )
    .sort((a, b) => a.startIndex - b.startIndex);

  // No references -> render exactly as before.
  if (valid.length === 0) {
    return (
      <p className={className} onClick={onTextClick}>
        {text}
      </p>
    );
  }

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  valid.forEach((m) => {
    if (m.startIndex < cursor) return; // skip overlaps
    if (m.startIndex > cursor) {
      segments.push(
        <Fragment key={`text-${cursor}-${m.startIndex}`}>
          {text.slice(cursor, m.startIndex)}
        </Fragment>,
      );
    }
    segments.push(
      <button
        type="button"
        key={`scripture-${m.key ?? m.reference}-${m.startIndex}-${m.endIndex}`}
        className="scripture-link"
        onClick={(e) => {
          e.stopPropagation();
          setActive(m);
        }}
      >
        {text.slice(m.startIndex, m.endIndex)}
      </button>,
    );
    cursor = m.endIndex;
  });
  if (cursor < text.length) {
    segments.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  }

  return (
    <>
      <p className={className} onClick={onTextClick}>
        {segments}
      </p>
      {active ? (
        <ScriptureModal
          mention={active}
          posterTranslation={posterTranslation}
          onClose={() => setActive(null)}
        />
      ) : null}
    </>
  );
}

export default ScriptureText;
