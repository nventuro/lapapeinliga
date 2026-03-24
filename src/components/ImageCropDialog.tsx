import { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface ImageCropDialogProps {
  src: string;
  onClose: () => void;
  onCrop: (croppedBlob: Blob) => void;
}

async function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to crop'))),
      'image/jpeg',
      0.9,
    );
  });
}

export default function ImageCropDialog({ src, onClose, onCrop }: ImageCropDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
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

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  async function handleSave() {
    if (!croppedArea) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(src, croppedArea);
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

      <div className="relative w-full aspect-square bg-on-surface rounded-lg overflow-hidden">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
        >
          {saving ? 'Recortando...' : 'Aplicar'}
        </button>
      </div>
    </dialog>
  );
}
