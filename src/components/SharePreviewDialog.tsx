import { useModalDialog } from '../hooks/useModalDialog';
import type { ImageSharePhase } from '../hooks/useEventImageShare';

interface SharePreviewDialogProps {
  phase: Exclude<ImageSharePhase, 'idle'>;
  /** The rendered poster; null while capturing, or when the capture failed. */
  imageUrl: string | null;
  onShare: () => void;
  onShareText: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const secondaryButton = 'px-4 py-2 text-sm rounded-lg border border-border hover:bg-border-subtle transition-colors';
const primaryButton = 'px-4 py-2 text-sm rounded-lg bg-primary text-on-primary font-medium hover:opacity-90 transition-opacity disabled:opacity-50';

/**
 * Shows the fecha image exactly as it will be shared, before anything leaves
 * the device. On desktop, where the image travels via the clipboard, the
 * dialog then confirms the copy and hands off to WhatsApp: opening it steals
 * focus, so the confirmation has to be on screen before the user navigates.
 */
export default function SharePreviewDialog({ phase, imageUrl, onShare, onShareText, onRetry, onClose }: SharePreviewDialogProps) {
  const { dialogRef, backdropClick } = useModalDialog(onClose);

  const capturing = phase === 'capturing';
  const failed = !capturing && imageUrl == null;

  function openWhatsApp() {
    window.open('https://web.whatsapp.com', '_blank', 'noopener');
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-[calc(100%-2rem)] max-w-sm backdrop:bg-on-surface/50"
      onClick={backdropClick}
    >
      <div className="p-4 sm:p-6 space-y-4" tabIndex={-1}>
        <h2 className="text-lg font-bold">Compartir por WhatsApp</h2>

        {/* The image and its placeholder share one 4:5 box, capped so the
            buttons stay on screen on a phone, so nothing jumps when it lands. */}
        {!failed && (
          <div className="mx-auto w-full max-w-[52dvh] aspect-[4/5]">
            {imageUrl ? (
              <img src={imageUrl} alt="Imagen de la fecha" className="w-full h-full rounded-lg" />
            ) : (
              <div aria-hidden className="w-full h-full rounded-lg bg-neutral animate-pulse" />
            )}
          </div>
        )}

        <p className="text-sm text-muted">
          {capturing && 'Armando la imagen…'}
          {failed && 'No pude armar la imagen. Podés mandar la fecha como texto.'}
          {phase === 'preview' && imageUrl && 'Así se va a ver en el chat.'}
          {phase === 'copied' && 'Imagen copiada: abrí WhatsApp y pegala en el chat.'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {phase !== 'copied' && !capturing && (
            <button type="button" onClick={onRetry} className="text-sm text-accent hover:underline">
              Generar de nuevo
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cerrar
            </button>
            {phase === 'copied' ? (
              <button type="button" onClick={openWhatsApp} className={primaryButton}>
                Abrir WhatsApp
              </button>
            ) : (
              <>
                <button type="button" onClick={onShareText} className={secondaryButton}>
                  Como texto
                </button>
                {!failed && (
                  <button type="button" onClick={onShare} disabled={capturing} className={primaryButton}>
                    Compartir
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
