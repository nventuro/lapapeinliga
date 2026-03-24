import { useState, useRef, useEffect, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropDialogProps {
  src: string;
  onClose: () => void;
  onCrop: (croppedBlob: Blob) => void;
  onSkip: () => void;
}

function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const canvas = document.createElement('canvas');
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to crop'))),
      'image/jpeg',
      0.9,
    );
  });
}

export default function ImageCropDialog({ src, onClose, onCrop, onSkip }: ImageCropDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  // Initialize crop to full image once it loads
  const onImageLoad = useCallback(() => {
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  }, []);

  async function handleSave() {
    if (!crop || !imgRef.current) return;

    // Convert percentage crop to pixels for the blob extraction
    const image = imgRef.current;
    const pixelCrop: PixelCrop = crop.unit === '%'
      ? {
          unit: 'px',
          x: (crop.x / 100) * image.width,
          y: (crop.y / 100) * image.height,
          width: (crop.width / 100) * image.width,
          height: (crop.height / 100) * image.height,
        }
      : { ...crop, unit: 'px' };

    if (pixelCrop.width < 1 || pixelCrop.height < 1) return;

    setSaving(true);
    try {
      const blob = await getCroppedBlob(image, pixelCrop);
      onCrop(blob);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl backdrop:bg-on-surface/50"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Recortar</h3>
        <button onClick={onClose} className="text-muted hover:text-muted-strong text-xl leading-none transition-colors">&times;</button>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-lg bg-on-surface flex items-center justify-center">
        <ReactCrop crop={crop} onChange={setCrop}>
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onImageLoad}
            className="max-w-full max-h-[60vh] block"
          />
        </ReactCrop>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onSkip}
          className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
        >
          Subir original
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
        >
          {saving ? 'Recortando...' : 'Aplicar recorte'}
        </button>
      </div>
    </dialog>
  );
}
