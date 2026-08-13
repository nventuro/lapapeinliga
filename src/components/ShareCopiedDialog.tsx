import { useModalDialog } from '../hooks/useModalDialog';

interface ShareCopiedDialogProps {
  onClose: () => void;
}

/**
 * Confirms that the share image landed in the clipboard and hands the user
 * off to WhatsApp to paste it. Shown only on browsers without file sharing
 * (desktop): opening WhatsApp steals focus, so the confirmation has to be on
 * screen before the user navigates, not after.
 */
export default function ShareCopiedDialog({ onClose }: ShareCopiedDialogProps) {
  const { dialogRef, backdropClick } = useModalDialog(onClose);

  function openWhatsApp() {
    window.open('https://web.whatsapp.com', '_blank', 'noopener');
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-full max-w-xs backdrop:bg-on-surface/50"
      onClick={backdropClick}
    >
      <div className="p-6 space-y-4" tabIndex={-1}>
        <h2 className="text-lg font-bold">Imagen copiada</h2>
        <p className="text-sm text-muted">
          La imagen de la fecha ya está en el portapapeles: abrí WhatsApp y pegala en el chat.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-border-subtle transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={openWhatsApp}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-on-primary font-medium hover:opacity-90 transition-opacity"
          >
            Abrir WhatsApp
          </button>
        </div>
      </div>
    </dialog>
  );
}
