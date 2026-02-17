import type { ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export default function Tooltip({ label, children, className = '' }: TooltipProps) {
  return (
    <span
      className={`group relative inline-flex items-center cursor-default focus:outline-none ${className}`}
      tabIndex={0}
    >
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-on-surface text-surface text-xs px-2 py-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-10">
        {label}
      </span>
    </span>
  );
}
