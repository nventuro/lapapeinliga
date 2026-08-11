import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MAX_VIDEO_HIGHLIGHT_LABEL_LENGTH } from '../types';
import type { VideoHighlight } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useAppContext } from '../context/appContext';
import { mediaUrl } from '../utils/mediaUpload';
import { PlusIcon, ShareIcon } from './icons';
import Tooltip from './Tooltip';

const COPY_FEEDBACK_MS = 2000;

interface EventVideoSectionProps {
  eventId: number;
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
 * Match video player with admin-curated highlights, styled for the navy hero
 * it sits in. `?t=<s>` deep-links into the video and `?end=<s>` additionally
 * stops playback there, so a link can carry a clip without the file ever
 * being cut — range requests mean only the watched window is downloaded.
 * Tapping a highlight plays from its instant and puts it in the URL, so the
 * moment on screen is always shareable.
 */
export default function EventVideoSection({ eventId, videoKey }: EventVideoSectionProps) {
  const { isAdmin } = useAppContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const clipStart = parseSeconds(searchParams.get('t'));
  const clipEnd = parseSeconds(searchParams.get('end'));

  // One-shot: pausing at the clip's end must not pin the video there — play
  // after the stop continues into the full recording.
  const stopAtRef = useRef<number | null>(clipEnd);

  const [copied, setCopied] = useState(false);

  // Admin highlight creation
  const [draftSeconds, setDraftSeconds] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, refetch } = useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('event_video_highlights')
      .select('*')
      .eq('event_id', eventId)
      .order('seconds');
    if (error) throw new Error(error.message);
    return data as VideoHighlight[];
  }, [eventId]);
  const highlights = data ?? [];

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

  function playHighlight(highlight: VideoHighlight) {
    const video = videoRef.current;
    if (!video) return;
    stopAtRef.current = null;
    video.currentTime = highlight.seconds;
    void video.play();
    setSearchParams({ t: String(highlight.seconds) }, { replace: true });
  }

  async function shareMoment() {
    const seconds = Math.floor(videoRef.current?.currentTime ?? 0);
    const params = seconds > 0 ? `?t=${seconds}` : '';
    const url = `${window.location.origin}${window.location.pathname}${params}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // User cancelled the share sheet — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }
  }

  function startDraft() {
    videoRef.current?.pause();
    setDraftSeconds(Math.floor(videoRef.current?.currentTime ?? 0));
    setDraftLabel('');
    setDraftError(null);
  }

  async function saveDraft() {
    if (draftSeconds === null || !draftLabel.trim()) return;
    const { error } = await supabase
      .from('event_video_highlights')
      .insert({ event_id: eventId, seconds: draftSeconds, label: draftLabel.trim() });
    if (error) {
      setDraftError('No se pudo guardar el momento.');
      return;
    }
    setDraftSeconds(null);
    refetch();
  }

  async function deleteHighlight(id: number) {
    setDeletingId(null);
    await supabase.from('event_video_highlights').delete().eq('id', id);
    refetch();
  }

  return (
    <div className="mt-4">
      <video
        ref={videoRef}
        src={mediaUrl(videoKey)}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-video rounded-md bg-on-surface"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Admin: label the paused instant */}
      {draftSeconds !== null && (
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-celeste shrink-0">Momento en {formatClock(draftSeconds)}</span>
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              maxLength={MAX_VIDEO_HIGHLIGHT_LABEL_LENGTH}
              placeholder="Qué pasó acá"
              autoFocus
              className="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-lg text-sm bg-surface text-on-surface placeholder:text-muted"
            />
            <button
              onClick={saveDraft}
              disabled={!draftLabel.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-lime text-on-lime hover:opacity-90 disabled:bg-disabled disabled:text-muted transition-opacity"
            >
              Guardar
            </button>
            <button
              onClick={() => setDraftSeconds(null)}
              className="text-xs text-celeste hover:text-on-primary transition-colors"
            >
              Cancelar
            </button>
          </div>
          {draftError && <p className="text-xs text-error-on-primary">{draftError}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {highlights.map((highlight) => {
          const active = clipStart === highlight.seconds && clipEnd === null;
          return (
            <span
              key={highlight.id}
              className={`flex items-center rounded-full text-xs font-semibold border transition-colors ${
                active ? 'bg-lime border-lime text-on-lime' : 'border-celeste/50 text-celeste'
              }`}
            >
              <button onClick={() => playHighlight(highlight)} className="flex items-center gap-1.5 pl-2.5 py-1 last:pr-2.5">
                <span className="font-normal opacity-80">{formatClock(highlight.seconds)}</span>
                {highlight.label}
              </button>
              {isAdmin && (
                deletingId === highlight.id ? (
                  <span className="flex items-center gap-1 px-2 py-1">
                    <button onClick={() => deleteHighlight(highlight.id)} className="font-bold">Sí</button>
                    /
                    <button onClick={() => setDeletingId(null)}>No</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setDeletingId(highlight.id)}
                    className="pl-1.5 pr-2 py-1 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                )
              )}
            </span>
          );
        })}
        <span className="ml-auto flex items-center gap-2">
          {copied && <span className="text-xs text-lime">¡Link copiado!</span>}
          <Tooltip label="Compartir este momento">
            <button onClick={shareMoment} className="text-celeste hover:text-on-primary transition-colors">
              <ShareIcon className="w-4 h-4" />
            </button>
          </Tooltip>
          {isAdmin && (
            <Tooltip label="Guardar este momento">
              <button onClick={startDraft} className="text-celeste hover:text-on-primary transition-colors">
                <PlusIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </span>
      </div>
    </div>
  );
}
