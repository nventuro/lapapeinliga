import { useRef, useState } from 'react';
import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';

interface TrophyCoverAdjustProps {
  cover: MediaItem;
  initialX: number;
  initialY: number;
  saving: boolean;
  onSave: (x: number, y: number) => void;
  onCancel: () => void;
}

/**
 * The detail hero in reframe mode: the admin drags the photo itself until the
 * faces sit inside the frame, then saves the focal point.
 *
 * Dragging moves the image the way a finger expects (drag right, see more of
 * the left), which is the *inverse* of the focal percentage: `object-position`
 * offsets the image by `-slack * focus%`, so a positive pixel delta subtracts
 * from the focus. The slack -- how much larger the scaled image is than the
 * frame -- is recomputed from the natural size on every move, so a resize
 * mid-drag cannot leave the math working against a stale frame. An axis with
 * no slack simply does not move, which is also the honest answer: there is
 * nothing hidden on that axis to reveal.
 *
 * The foil treatment is deliberately absent here: a glimmer sweeping the photo
 * while someone is trying to line up faces is exactly the distraction this
 * mode exists to remove.
 */
export default function TrophyCoverAdjust({
  cover, initialX, initialY, saving, onSave, onCancel,
}: TrophyCoverAdjustProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ pointerId: number; x: number; y: number; focusX: number; focusY: number } | null>(null);
  const [focus, setFocus] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = {
      pointerId: e.pointerId, x: e.clientX, y: e.clientY, focusX: focus.x, focusY: focus.y,
    };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!start || start.pointerId !== e.pointerId || !frame || !img || img.naturalWidth === 0) return;

    const scale = Math.max(
      frame.clientWidth / img.naturalWidth,
      frame.clientHeight / img.naturalHeight,
    );
    const slackX = img.naturalWidth * scale - frame.clientWidth;
    const slackY = img.naturalHeight * scale - frame.clientHeight;

    const clamp = (value: number) => Math.min(100, Math.max(0, value));
    setFocus({
      x: slackX >= 1 ? clamp(start.focusX - ((e.clientX - start.x) / slackX) * 100) : start.focusX,
      y: slackY >= 1 ? clamp(start.focusY - ((e.clientY - start.y) / slackY) * 100) : start.focusY,
    });
  }

  function handlePointerEnd() {
    dragStart.current = null;
    setDragging(false);
  }

  return (
    <div
      ref={frameRef}
      className={`absolute inset-0 touch-none select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <img
        ref={imgRef}
        src={mediaUrl(cover.storage_path)}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
      />

      <p className="absolute top-3 inset-x-0 mx-auto w-fit rounded-full bg-primary/80 text-on-primary text-xs px-3 py-1 pointer-events-none">
        Arrastrá la foto para encuadrarla
      </p>

      {/* A press on a button must be a press, not the start of a drag: with the
          pointer captured by the frame, the browser would swallow the click. */}
      <div
        className="absolute bottom-3 right-3 flex gap-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-lg bg-surface border border-border hover:bg-border-subtle transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(Math.round(focus.x), Math.round(focus.y))}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-lg bg-primary text-on-primary font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
