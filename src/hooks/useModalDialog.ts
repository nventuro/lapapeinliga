import { useEffect, useRef } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

/**
 * Shared plumbing for native <dialog> modals: opens the dialog on mount,
 * locks body scroll, turns Escape (the native 'cancel' event) into onClose,
 * and closes on backdrop click.
 *
 * Usage:
 *   const { dialogRef, backdropClick } = useModalDialog(onClose);
 *   return <dialog ref={dialogRef} onClick={backdropClick} className={...}>
 *
 * The latest onClose is tracked in a ref, so callers may pass inline
 * functions without re-running the open/listen effect every render.
 */
export function useModalDialog(onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useBodyScrollLock();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, []);

  function backdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    // Clicks on the dialog's children hit those elements; only a click on the
    // dialog element itself (i.e. the backdrop area) closes.
    if (e.target === e.currentTarget) onCloseRef.current();
  }

  return { dialogRef, backdropClick };
}
