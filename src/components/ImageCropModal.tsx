import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import './ImageCropModal.css';

type Props = {
  open: boolean;
  imageSrc: string;
  /** width / height. 1 = square avatar, 16/9 = header banner. */
  aspect: number;
  cropShape?: 'rect' | 'round';
  fileName?: string;
  /** Longest edge of the exported image in px. */
  maxSize?: number;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
};

/** Draw the selected crop area to a canvas and export it as a JPEG File. */
async function cropToFile(
  imageSrc: string,
  area: Area,
  aspect: number,
  fileName: string,
  maxSize: number,
): Promise<{ file: File; previewUrl: string }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const outWidth = Math.min(maxSize, area.width);
  const outHeight = aspect >= 1 ? outWidth / aspect : outWidth; // keep longest edge <= maxSize
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(aspect >= 1 ? outWidth : outHeight * aspect);
  canvas.height = Math.round(aspect >= 1 ? outWidth / aspect : outHeight);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );
  if (!blob) throw new Error('Could not export image');
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  return { file, previewUrl: URL.createObjectURL(blob) };
}

export function ImageCropModal({
  open,
  imageSrc,
  aspect,
  cropShape = 'rect',
  fileName = 'image.jpg',
  maxSize = 1280,
  onCancel,
  onConfirm,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  if (!open) return null;

  const handleSave = async () => {
    if (!area) return;
    setSaving(true);
    try {
      const result = await cropToFile(imageSrc, area, aspect, fileName, maxSize);
      onConfirm(result.file, result.previewUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crop-modal" role="dialog" aria-modal="true" aria-label="Crop image">
      <div className="crop-modal__panel">
        <div className="crop-modal__stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="crop-modal__controls">
          <label className="crop-modal__zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
            />
          </label>
          <div className="crop-modal__actions">
            <button type="button" className="btn btn--outline btn--sm" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn--brand btn--sm" onClick={handleSave} disabled={saving || !area}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageCropModal;
