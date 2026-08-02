import type { ReactNode } from 'react';

/** The small display-face heading that names a band of content on a page. */
export default function SectionLabel({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return (
    <h2 className={`font-display text-xs tracking-widest mb-2 flex items-center gap-1.5 ${dim ? 'text-muted' : 'text-on-surface'}`}>
      {children}
    </h2>
  );
}
