import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** Keep the bubble this far clear of the viewport edge. */
const EDGE_MARGIN_PX = 8;

export default function Tooltip({ label, children, className = '' }: TooltipProps) {
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [shiftPx, setShiftPx] = useState(0);

  /**
   * The bubble is centred on its trigger, so one near a viewport edge hangs off
   * it. Nudge it back inside. Measuring from the un-shifted position keeps this
   * idempotent, and running before paint means the correction is never visible.
   */
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!open || !bubble) return;

    const previous = bubble.style.transform;
    bubble.style.transform = 'translateX(-50%)';
    const { left, right } = bubble.getBoundingClientRect();
    bubble.style.transform = previous;

    const viewportWidth = document.documentElement.clientWidth;
    if (right > viewportWidth - EDGE_MARGIN_PX) {
      setShiftPx(viewportWidth - EDGE_MARGIN_PX - right);
    } else if (left < EDGE_MARGIN_PX) {
      setShiftPx(EDGE_MARGIN_PX - left);
    } else {
      setShiftPx(0);
    }
  }, [open]);

  return (
    <span
      className={`group relative inline-flex items-center cursor-default focus:outline-none ${className}`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {/* Mounted only while shown: an always-present absolute bubble widened the
          document and scrolled the whole page sideways on narrow screens. */}
      {open && (
        <span
          ref={bubbleRef}
          style={{ transform: `translateX(calc(-50% + ${shiftPx}px))` }}
          className="pointer-events-none absolute -top-8 left-1/2 whitespace-nowrap rounded bg-on-surface text-surface text-xs px-2 py-1 z-10 animate-tooltip-in"
        >
          {label}
        </span>
      )}
    </span>
  );
}
