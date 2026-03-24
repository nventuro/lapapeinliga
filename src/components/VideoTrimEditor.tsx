import { useState, useRef, useEffect, useCallback } from 'react';
import { createBoomerang } from '../utils/videoProcessing';

interface VideoTrimEditorProps {
  file: File;
  onConfirm: (processedBlob: Blob) => void;
}

export default function VideoTrimEditor({ file, onConfirm }: VideoTrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useRef<string>('');

  // Create object URL for the video
  useEffect(() => {
    previewUrl.current = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(previewUrl.current);
  }, [file]);

  // Set duration once video loads
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setEndTime(Math.min(video.duration, 3)); // Default to 3 seconds or full duration
  }, []);

  // Boomerang preview: play forward then reverse in the trimmed region
  useEffect(() => {
    const video = videoRef.current;
    if (!video || duration === 0) return;

    let animFrame: number;
    let direction: 'forward' | 'reverse' = 'forward';

    function tick() {
      if (!video) return;

      if (direction === 'forward') {
        if (video.currentTime >= endTime) {
          direction = 'reverse';
          video.playbackRate = -1;
          // playbackRate < 0 is not supported in most browsers,
          // so we'll just reset to start for the "reverse" effect
          video.currentTime = startTime;
          direction = 'forward';
        }
      }

      animFrame = requestAnimationFrame(tick);
    }

    video.currentTime = startTime;
    video.play().catch(() => { /* autoplay blocked, user can interact */ });
    animFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animFrame);
  }, [startTime, endTime, duration]);

  async function handleConfirm() {
    setProcessing(true);
    setError(null);
    try {
      const blob = await createBoomerang(file, startTime, endTime);
      onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar video');
    } finally {
      setProcessing(false);
    }
  }

  const trimDuration = endTime - startTime;

  return (
    <div className="space-y-3">
      {/* Video preview */}
      <div className="rounded-lg overflow-hidden bg-on-surface">
        <video
          ref={videoRef}
          src={previewUrl.current}
          onLoadedMetadata={handleLoadedMetadata}
          autoPlay
          loop
          muted
          playsInline
          className="w-full max-h-48 object-contain"
        />
      </div>

      {/* Timeline with trim handles */}
      {duration > 0 && (
        <div className="space-y-2">
          <div className="flex gap-3 items-center">
            <label className="text-xs text-muted shrink-0">Inicio</label>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={startTime}
              onChange={(e) => {
                const val = Number(e.target.value);
                setStartTime(Math.min(val, endTime - 0.2));
              }}
              className="flex-1 accent-primary"
            />
            <span className="text-xs text-muted tabular-nums w-10 text-right">{startTime.toFixed(1)}s</span>
          </div>
          <div className="flex gap-3 items-center">
            <label className="text-xs text-muted shrink-0">Fin</label>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={endTime}
              onChange={(e) => {
                const val = Number(e.target.value);
                setEndTime(Math.max(val, startTime + 0.2));
              }}
              className="flex-1 accent-primary"
            />
            <span className="text-xs text-muted tabular-nums w-10 text-right">{endTime.toFixed(1)}s</span>
          </div>
          <p className="text-xs text-muted text-center">
            Duración: {trimDuration.toFixed(1)}s
          </p>
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={processing || duration === 0}
        className="w-full py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
      >
        {processing ? 'Procesando...' : 'Confirmar'}
      </button>
    </div>
  );
}
