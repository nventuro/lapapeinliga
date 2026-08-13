import { useEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import type { EventWithDetails } from '../types';
import { buildEventShareMessage, openWhatsAppShare } from '../utils/shareMessage';
import { POSTER_PIXEL_RATIO } from '../components/EventSharePoster';

export type ImageSharePhase = 'idle' | 'capturing' | 'copied';

/** Rasterizes a mounted poster node to a PNG blob, or null when that fails. */
export async function capturePosterImage(poster: HTMLElement): Promise<Blob | null> {
  try {
    await document.fonts.ready;
    // WebKit's first rasterization pass can miss embedded fonts and images;
    // capture twice and keep the second.
    await toBlob(poster, { pixelRatio: POSTER_PIXEL_RATIO });
    return await toBlob(poster, { pixelRatio: POSTER_PIXEL_RATIO });
  } catch {
    return null;
  }
}

/**
 * Shares an event as an image. `start()` kicks off a capture; while phase is
 * 'capturing' the caller must render the poster inside `posterMountRef`, and
 * while it is 'copied' it must show the paste-into-WhatsApp dialog (closed
 * via `closeDialog`).
 *
 * The image travels by whichever path the browser supports: the OS share
 * sheet where files can be shared (phones), otherwise the clipboard
 * (desktop). When neither works, the plain-text WhatsApp message goes out
 * instead, so sharing never dead-ends.
 */
export function useEventImageShare(event: EventWithDetails | null, eventNumber: string) {
  const [phase, setPhase] = useState<ImageSharePhase>('idle');
  const posterMountRef = useRef<HTMLDivElement>(null);

  // The capture effect reads these through refs so it depends only on
  // `phase` and cannot re-fire mid-capture on unrelated re-renders.
  const eventRef = useRef(event);
  const eventNumberRef = useRef(eventNumber);
  useEffect(() => {
    eventRef.current = event;
    eventNumberRef.current = eventNumber;
  }, [event, eventNumber]);

  useEffect(() => {
    if (phase !== 'capturing') return;

    const shareAsText = () => {
      const current = eventRef.current;
      if (current) openWhatsAppShare(buildEventShareMessage(current, eventNumberRef.current));
    };

    (async () => {
      const poster = posterMountRef.current?.firstElementChild;
      if (!(poster instanceof HTMLElement)) {
        shareAsText();
        setPhase('idle');
        return;
      }

      // Probe support with an empty file so no time is spent rasterizing
      // before knowing which path applies.
      const probe = new File([], 'fecha.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [probe] })) {
        const blob = await capturePosterImage(poster);
        if (!blob) {
          shareAsText();
          setPhase('idle');
          return;
        }
        const file = new File([blob], `fecha-${eventNumberRef.current}.png`, { type: 'image/png' });
        // A rejection here is the user closing the share sheet — not a
        // failure to share, so no fallback.
        await navigator.share({ files: [file] }).catch(() => {});
        setPhase('idle');
        return;
      }

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // The write only counts as user-initiated for a few seconds after
        // the click, and rasterizing can outlast that — so the write is
        // registered now and handed the capture as a promise.
        const pending = capturePosterImage(poster).then((blob) => {
          if (!blob) throw new Error('capture failed');
          return blob;
        });
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': pending })]);
          setPhase('copied');
          return;
        } catch {
          // Some browsers reject promise payloads outright; the capture may
          // still have finished in time to write the blob directly.
          const blob = await pending.catch(() => null);
          if (blob) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              setPhase('copied');
              return;
            } catch {
              // Denied by permission or focus loss; fall through.
            }
          }
        }
      }

      shareAsText();
      setPhase('idle');
    })();
  }, [phase]);

  return {
    phase,
    posterMountRef,
    start: () => setPhase((p) => (p === 'idle' ? 'capturing' : p)),
    closeDialog: () => setPhase('idle'),
  };
}
