export type ComposerMediaItem = {
  id: string;
  kind: 'photo' | 'video';
  file: File;
  previewUrl: string;
};

const newComposerMediaId = (): string =>
  `mi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function buildComposerMediaItem(file: File): ComposerMediaItem {
  const kind: ComposerMediaItem['kind'] = file.type.startsWith('video/') ? 'video' : 'photo';
  return {
    id: newComposerMediaId(),
    kind,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}
