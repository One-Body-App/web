import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, GripVertical, ImageIcon, X } from 'lucide-react';
import './ComposerMediaTray.css';

export type ComposerMediaItem = {
  id: string;
  kind: 'photo' | 'video';
  // The File the user picked. Kept so we can hand it back to the upload call.
  file: File;
  // An ObjectURL we can render in the <img> / <video>.
  previewUrl: string;
};

export type ComposerMediaTrayProps = {
  items: ComposerMediaItem[];
  onChange: (next: ComposerMediaItem[]) => void;
  maxItems?: number;
};

const DEFAULT_MAX = 10;

const newId = (): string => `mi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function buildComposerMediaItem(file: File): ComposerMediaItem {
  const kind: 'photo' | 'video' = file.type.startsWith('video/') ? 'video' : 'photo';
  return {
    id: newId(),
    kind,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export function ComposerMediaTray({ items, onChange, maxItems = DEFAULT_MAX }: ComposerMediaTrayProps) {
  const dragSourceRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // Best-effort revoke when the tray unmounts. Items the parent kept will
      // keep their URLs alive via re-creation.
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
    // We intentionally do not include `items` in deps - revoke should fire once
    // on unmount, not on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remove(id: string) {
    const next = items.filter((item) => item.id !== id);
    const removed = items.find((item) => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  }

  function onDragStart(id: string) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = 'move';
      dragSourceRef.current = id;
    };
  }

  function onDragOver(id: string) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverId(id);
    };
  }

  function onDrop(targetId: string) {
    return (event: React.DragEvent<HTMLDivElement>) => {
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
    <div className="cmt" role="list" aria-label="Selected media">
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            role="listitem"
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
            <div className="cmt__handle" aria-hidden>
              <GripVertical size={14} />
            </div>
            {item.kind === 'video' ? (
              <video className="cmt__preview" src={item.previewUrl} muted playsInline />
            ) : (
              <img className="cmt__preview" src={item.previewUrl} alt="" />
            )}
            <span className={`cmt__kind cmt__kind--${item.kind}`} aria-hidden>
              {item.kind === 'video' ? <Film size={11} /> : <ImageIcon size={11} />}
              <span>{item.kind === 'video' ? 'Video' : 'Photo'}</span>
            </span>
            <span className="cmt__index" aria-hidden>
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
          </motion.div>
        ))}
      </AnimatePresence>
      {items.length >= maxItems ? (
        <p className="cmt__hint" role="status">
          Max {maxItems} items per post.
        </p>
      ) : null}
    </div>
  );
}
