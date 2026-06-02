import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, GripVertical, ImageIcon, X } from 'lucide-react';
import type { ComposerMediaItem } from './composerMedia';
import './ComposerMediaTray.css';

export type ComposerMediaTrayProps = {
  items: ComposerMediaItem[];
  onChange: (next: ComposerMediaItem[]) => void;
  maxItems?: number;
};

const DEFAULT_MAX = 10;

export function ComposerMediaTray({ items, onChange, maxItems = DEFAULT_MAX }: ComposerMediaTrayProps) {
  const dragSourceRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  itemsRef.current = items;

  const trayRef = useCallback((node: HTMLUListElement | null) => {
    if (node) return;
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  function remove(id: string) {
    const next = items.filter((item) => item.id !== id);
    const removed = items.find((item) => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  }

  function onDragStart(id: string) {
    return (event: React.DragEvent<HTMLLIElement>) => {
      event.dataTransfer.effectAllowed = 'move';
      dragSourceRef.current = id;
    };
  }

  function onDragOver(id: string) {
    return (event: React.DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverId(id);
    };
  }

  function onDrop(targetId: string) {
    return (event: React.DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const sourceId = dragSourceRef.current;
      dragSourceRef.current = null;
      setDragOverId(null);
      if (!sourceId || sourceId === targetId) return;
      const sourceIndex = items.findIndex((item) => item.id === sourceId);
      const targetIndex = items.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;
      const next = items.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      onChange(next);
    };
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <ul className="cmt" aria-label="Selected media" ref={trayRef}>
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.94, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              // Disable motion's drag gesture so the HTML5 DnD props below take effect.
              drag={false}
              draggable
              onDragStartCapture={onDragStart(item.id)}
              onDragOverCapture={onDragOver(item.id)}
              onDragLeave={() => setDragOverId((current) => (current === item.id ? null : current))}
              onDropCapture={onDrop(item.id)}
              className={`cmt__item${dragOverId === item.id ? ' is-dropping' : ''}`}
            >
              <div className="cmt__handle" aria-hidden="true">
                <GripVertical size={14} />
              </div>
              {item.kind === 'video' ? (
                <video
                  className="cmt__preview"
                  src={item.previewUrl}
                  muted
                  playsInline
                  aria-label={`Selected video ${index + 1} preview`}
                />
              ) : (
                <img className="cmt__preview" src={item.previewUrl} alt="" />
              )}
              <span className={`cmt__kind cmt__kind--${item.kind}`} aria-hidden="true">
                {item.kind === 'video' ? <Film size={11} /> : <ImageIcon size={11} />}
                <span>{item.kind === 'video' ? 'Video' : 'Photo'}</span>
              </span>
              <span className="cmt__index" aria-hidden="true">
                {index + 1}
              </span>
              <button
                type="button"
                className="cmt__remove"
                onClick={() => remove(item.id)}
                aria-label={`Remove media ${index + 1}`}
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length >= maxItems ? (
        <p className="cmt__hint" aria-live="polite">
          Max {maxItems} items per post.
        </p>
      ) : null}
    </>
  );
}
