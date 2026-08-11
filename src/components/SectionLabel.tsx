import type { ReactNode } from 'react';

/** The small display-face heading that names a band of content on a page. */
export default function SectionLabel({ children, dim = false, className = 'mb-2' }: { children: ReactNode; dim?: boolean; className?: string }) {
  return (
    <h2 className={`font-display text-xs tracking-widest flex items-center gap-1.5 ${className} ${dim ? 'text-muted' : 'text-on-surface'}`}>
      {children}
    </h2>
  );
}
