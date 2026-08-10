import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mediaUrl } from '../utils/mediaUpload';

const COPY_FEEDBACK_MS = 2000;

interface EventVideoSectionProps {
  videoKey: string;
}

/** Seconds → clock label (m:ss, or h:mm:ss from an hour up). */
function formatClock(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function parseSeconds(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Match video player with shareable moments. `?t=<s>` deep-links into the
 * video and `?end=<s>` additionally stops playback there, so a link can carry
 * a clip without the file ever being cut — range requests mean only the
 * watched window is downloaded.
 */
export default function EventVideoSection({ videoKey }: EventVideoSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const clipStart = parseSeconds(searchParams.get('t'));
  const clipEnd = parseSeconds(searchParams.get('end'));
  const isClip = clipStart !== null || clipEnd !== null;

  // One-shot: pausing at the clip's end must not pin the video there — play
  // after the stop continues into the full recording.
  const stopAtRef = useRef<number | null>(clipEnd);

  const [markStart, setMarkStart] = useState<number | null>(null);
  const [markEnd, setMarkEnd] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (video && clipStart !== null) video.currentTime = clipStart;
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || stopAtRef.current === null) return;
    if (video.currentTime >= stopAtRef.current) {
      video.pause();
      stopAtRef.current = null;
    }
  }

  function showFull() {
    stopAtRef.current = null;
    setSearchParams({}, { replace: true });
  }

  async function copyLink() {
    const start = markStart ?? Math.floor(videoRef.current?.currentTime ?? 0);
    const params = new URLSearchParams({ t: String(start) });
    if (markEnd !== null && markEnd > start) params.set('end', String(markEnd));
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }

  const markButtonClass =
    'px-2 py-1 rounded-lg text-xs font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors';

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-muted">Video</h3>
        {isClip && (
          <button
            onClick={showFull}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Ver video completo
          </button>
        )}
      </div>

      <video
        ref={videoRef}
        src={mediaUrl(videoKey)}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-video rounded-lg bg-on-surface"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />

      {isClip && (
        <p className="text-xs text-muted mt-1">
          Estás viendo un recorte (
          {clipEnd !== null
            ? `${formatClock(clipStart ?? 0)}–${formatClock(clipEnd)}`
            : `desde ${formatClock(clipStart ?? 0)}`}
          ).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="text-xs text-muted">Compartir momento:</span>
        <button onClick={() => setMarkStart(Math.floor(videoRef.current?.currentTime ?? 0))} className={markButtonClass}>
          {markStart !== null ? `Inicio ${formatClock(markStart)}` : 'Marcar inicio'}
        </button>
        <button onClick={() => setMarkEnd(Math.ceil(videoRef.current?.currentTime ?? 0))} className={markButtonClass}>
          {markEnd !== null ? `Fin ${formatClock(markEnd)}` : 'Marcar fin'}
        </button>
        {(markStart !== null || markEnd !== null) && (
          <button
            onClick={() => { setMarkStart(null); setMarkEnd(null); }}
            className="text-xs text-muted hover:text-muted-strong transition-colors"
          >
            Limpiar
          </button>
        )}
        <button onClick={copyLink} className="text-xs font-medium text-accent hover:text-accent-hover transition-colors">
          {copied ? '¡Link copiado!' : 'Copiar link'}
        </button>
      </div>
    </div>
  );
}
