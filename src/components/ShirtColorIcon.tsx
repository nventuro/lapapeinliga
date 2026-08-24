import type { ShirtColor } from '../types';
import { ShirtIcon } from './icons';

// Tailwind only emits classes it can see spelled out, so each shirt maps to
// its class in a literal table rather than a template string.
const ICON_CLASS: Record<ShirtColor, string> = {
  light: 'text-shirt-light',
  dark: 'text-shirt-dark',
  red: 'text-shirt-red',
  blue: 'text-shirt-blue',
};

interface ShirtColorIconProps {
  color: ShirtColor;
  className?: string;
}

/** The jersey icon painted in a shirt color. The caller wraps it in its tooltip. */
export default function ShirtColorIcon({ color, className = '' }: ShirtColorIconProps) {
  return <ShirtIcon className={`${ICON_CLASS[color]} ${className}`} />;
}
