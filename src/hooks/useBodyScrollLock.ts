import { useEffect } from 'react';

/** Prevents background scroll while the calling component is mounted. */
export function useBodyScrollLock() {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);
}
