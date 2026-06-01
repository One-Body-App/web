import { useState } from 'react';
import { Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FULL_REACTION_PICKER_ITEMS,
  getReactionItem,
  type FullReactionKind,
} from '@/api/reactions';
import './ReactionRail.css';

type ReactionRailProps = {
  activeReaction: FullReactionKind | null;
  total: number;
  onToggleDefault: () => void;
  onSelect: (kind: FullReactionKind) => void;
  ariaLabel?: string;
  compact?: boolean;
  disabled?: boolean;
};

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

export function ReactionRail({
  activeReaction,
  total,
  onToggleDefault,
  onSelect,
  ariaLabel = 'React',
  compact = false,
  disabled = false,
}: ReactionRailProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const active = getReactionItem(activeReaction);

  return (
    <div
      className={`reaction-rail${compact ? ' reaction-rail--compact' : ''}`}
      onMouseEnter={() => !disabled && setPickerOpen(true)}
      onMouseLeave={() => setPickerOpen(false)}
    >
      <button
        type="button"
        className={`reaction-rail__trigger${active ? ' is-active' : ''}`}
        style={active ? { color: active.color } : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onToggleDefault();
        }}
        aria-label={active ? active.label : ariaLabel}
        disabled={disabled}
      >
        {active ? (
          <img src={active.iconUrl} alt="" aria-hidden="true" className="reaction-rail__active-icon" />
        ) : (
          <Heart size={compact ? 16 : 22} />
        )}
        {total > 0 ? <span>{formatCount(total)}</span> : null}
      </button>

      <AnimatePresence>
        {pickerOpen ? (
          <motion.div
            className="reaction-rail__picker glass"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.16 }}
          >
            {FULL_REACTION_PICKER_ITEMS.map((reaction) => (
              <button
                type="button"
                key={reaction.kind}
                className="reaction-rail__picker-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setPickerOpen(false);
                  onSelect(reaction.kind);
                }}
                title={reaction.label}
              >
                <img src={reaction.iconUrl} alt="" aria-hidden="true" />
                <small>{reaction.label}</small>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
