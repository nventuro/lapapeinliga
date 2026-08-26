import { useEffect, useRef, useState } from 'react';
import { getFontEmbedCSS, toBlob } from 'html-to-image';
import type { EventWithDetails } from '../types';
import { buildEventShareCaption, buildEventShareMessage, openWhatsAppShare, openWhatsAppWebDraft } from '../utils/shareMessage';
import { POSTER_PIXEL_RATIO } from '../components/EventSharePoster';

export type ImageSharePhase = 'idle' | 'capturing' | 'preview' | 'copied';

/** How many rasterization passes to try before giving up on two agreeing. */
const MAX_CAPTURE_PASSES = 4;

/** The poster as a PNG, plus an object URL for showing it. */
interface ShareImage {
  blob: Blob;
  url: string;
}

/**
 * The faces the poster sets, as `document.fonts.load` shorthands. The poster
 * measures itself on mount to decide whether it fits the frame, so it must be
 * mounted with these loaded, not in the fallbacks a still-loading font leaves.
 */
const POSTER_FONTS = ['600 14px Archivo', '800 22px Archivo', '9px Graduate'];

function loadPosterFonts(): Promise<unknown> {
  return Promise.all(POSTER_FONTS.map((font) => document.fonts.load(font)));
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * The poster's fonts, as @font-face CSS with every font file inlined as a
 * data: URI, built from the page's own Google Fonts stylesheet. The capture
 * renders in an isolated document that cannot reach the page's fonts, so
 * they must travel inside the image. html-to-image's own font collection is
 * not usable for this: it reads `CSSFontFaceRule.style.fontFamily`, which
 * Firefox does not expose, and the whole capture throws.
 */
let posterFontCSS: Promise<string | undefined> | undefined;
function loadPosterFontCSS(): Promise<string | undefined> {
  posterFontCSS ??= (async () => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="stylesheet"][href*="fonts.googleapis.com"]',
    );
    if (!link) return undefined;
    const css = await (await fetch(link.href)).text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    const inlined = await Promise.all(
      urls.map(async (url) => [url, await blobToDataURL(await (await fetch(url)).blob())] as const),
    );
    return inlined.reduce((out, [url, dataURL]) => out.replaceAll(url, dataURL), css);
  })().catch(() => {
    // Not cached: a failed fetch may be transient, so the next capture retries.
    posterFontCSS = undefined;
    return undefined;
  });
  return posterFontCSS;
}


async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  return u.every((byte, i) => byte === v[i]);
}

/**
 * Rasterizes a mounted poster node to a PNG blob, or null when the result
 * cannot be trusted — the caller then offers the text share instead.
 */
export async function capturePosterImage(poster: HTMLElement): Promise<Blob | null> {
  try {
    await document.fonts.ready;
    // A font file that could not be inlined stays a remote URL, which the
    // capture document cannot load, and the poster would silently come out
    // in the fallback faces.
    const fontEmbedCSS = (await loadPosterFontCSS()) ?? (await getFontEmbedCSS(poster));
    if (fontEmbedCSS === '' || /url\((?!["']?data:)/.test(fontEmbedCSS)) return null;
    // WebKit can paint the image before its embedded fonts have loaded, so a
    // pass is only trusted once the next one reproduces it byte for byte.
    let previous: Blob | null = null;
    for (let pass = 0; pass < MAX_CAPTURE_PASSES; pass++) {
      const blob = await toBlob(poster, { pixelRatio: POSTER_PIXEL_RATIO, fontEmbedCSS });
      if (!blob) return null;
      if (previous && (await sameBytes(previous, blob))) return blob;
      previous = blob;
    }
    return previous;
  } catch {
    return null;
  }
}

/**
 * Shares an event as an image, with the image shown before it leaves the
 * device. `start()` kicks off a capture; while `renderPoster` is true the
 * caller must render the poster inside `posterMountRef`, and while `phase`
 * is anything but 'idle' it must show the preview dialog, wired to
 * `shareImage`, `shareText`, `openWhatsApp`, `retry` and `close`.
 *
 * The maps link goes along as the image's caption: in the share sheet on
 * phones, and drafted in WhatsApp Web by `openWhatsApp` on desktop, where
 * the clipboard can only carry the image.
 *
 * The share sheet (phones) and the clipboard (desktop) both have to be
 * reached from a user gesture, so `shareImage` does its privileged call
 * synchronously from the tap on the preview, with the image already in hand.
 * When neither path works, the plain-text WhatsApp message goes out instead,
 * so sharing never dead-ends.
 */
export function useEventImageShare(event: EventWithDetails | null, eventNumber: string) {
  const [phase, setPhase] = useState<ImageSharePhase>('idle');
  const [image, setImage] = useState<ShareImage | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const posterMountRef = useRef<HTMLDivElement>(null);

  // The poster is mounted only once its fonts are loaded: it measures itself
  // on mount, and a face arriving afterwards would reflow it past the frame.
  useEffect(() => {
    if (phase !== 'capturing' || fontsLoaded) return;
    let cancelled = false;
    loadPosterFonts().then(() => {
      if (!cancelled) setFontsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, fontsLoaded]);
  const renderPoster = phase === 'capturing' && fontsLoaded;

  useEffect(() => {
    if (!renderPoster) return;
    let cancelled = false;
    const poster = posterMountRef.current?.firstElementChild;
    (async () => {
      const blob = poster instanceof HTMLElement ? await capturePosterImage(poster) : null;
      if (cancelled) return;
      setImage(blob ? { blob, url: URL.createObjectURL(blob) } : null);
      setPhase('preview');
    })();
    return () => {
      cancelled = true;
    };
  }, [renderPoster]);

  const clearImage = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
  };

  const close = () => {
    setPhase('idle');
    clearImage();
  };

  const shareText = () => {
    if (event) openWhatsAppShare(buildEventShareMessage(event, eventNumber));
    close();
  };

  const caption = event ? buildEventShareCaption(event) : '';

  const openWhatsApp = () => {
    openWhatsAppWebDraft(caption);
    close();
  };

  const shareImage = () => {
    if (!image) {
      shareText();
      return;
    }
    const file = new File([image.blob], `fecha-${eventNumber}.png`, { type: 'image/png' });
    const shareData: ShareData = { files: [file], text: caption || undefined };
    if (navigator.canShare?.(shareData)) {
      // A rejection is the user closing the share sheet; the preview stays up
      // so they can try again or send the text instead.
      navigator.share(shareData).then(close, () => {});
      return;
    }
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': image.blob })])
        .then(() => setPhase('copied'), shareText);
      return;
    }
    shareText();
  };

  const capture = () => {
    clearImage();
    setPhase('capturing');
  };

  return {
    phase,
    imageUrl: image?.url ?? null,
    renderPoster,
    posterMountRef,
    start: () => {
      if (phase === 'idle') capture();
    },
    shareImage,
    shareText,
    openWhatsApp,
    retry: capture,
    close,
  };
}
