import type { ReactNode } from 'react';

const CHIP_TONES = {
  info: 'bg-accent-subtle text-accent',
  win: 'bg-lime text-on-lime',
  loss: 'bg-error-subtle text-error',
  neutral: 'bg-border-subtle text-muted',
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export default function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** The chip's own layout wrapper -- kept alongside it since it exists only to lay chips out. */
export function ChipRow({ children, className = 'mt-2' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>{children}</div>;
}
