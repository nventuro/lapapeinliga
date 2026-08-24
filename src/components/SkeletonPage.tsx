import type { ReactNode } from 'react';

/**
 * The root of a page drawn as placeholders: lays out like the real page and
 * tells assistive tech that the content is loading, since the blocks
 * themselves say nothing.
 */
export default function SkeletonPage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}
