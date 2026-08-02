import { useCallback, useEffect, useRef, useState } from 'react';

interface TabStripScroll {
  ref: React.RefObject<HTMLElement | null>;
  /** True when there is content scrolled off that side. */
  fadeStart: boolean;
  fadeEnd: boolean;
}

/**
 * Keeps a horizontally scrolling tab strip honest.
 *
 * Two jobs, both of which the strip needs once it stops fitting:
 *   * report which side has content off-screen, so the caller can fade that
 *     edge — with the scrollbar hidden, a hard clip reads as "the list ends
 *     here", not as "there is more";
 *   * pull the active tab into view when the route changes, so you can never
 *     be on a section whose tab is off-screen.
 *
 * The active tab is found by `[data-active="true"]`, and it is scrolled by
 * setting scrollLeft rather than scrollIntoView, which would also scroll the
 * page vertically on its way there.
 */
export function useTabStripScroll(activeKey: string): TabStripScroll {
  const ref = useRef<HTMLElement>(null);
  const [fadeStart, setFadeStart] = useState(false);
  const [fadeEnd, setFadeEnd] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Sub-pixel layout means the two ends never land exactly on 0 / scrollWidth.
    setFadeStart(el.scrollLeft > 1);
    setFadeEnd(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();

    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>('[data-active="true"]');
    if (!el || !active) return;

    const GUTTER_PX = 12;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < el.scrollLeft) {
      el.scrollLeft = Math.max(0, left - GUTTER_PX);
    } else if (right > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = right - el.clientWidth + GUTTER_PX;
    }
    measure();
  }, [activeKey, measure]);

  return { ref, fadeStart, fadeEnd };
}
