interface SkeletonProps {
  /** Size, shape and spacing, radius included wherever the corners show. */
  className?: string;
  /** For a block on a colored fill (the navy hero, the celeste rail), where
   *  the canvas greys would read as a hole rather than a placeholder. */
  onFill?: boolean;
  /** Sits in a line of text instead of taking a line of its own. */
  inline?: boolean;
}

/**
 * A placeholder block for content that is still on its way. Size and shape it
 * like the text or element it stands in for, so the page keeps its final
 * layout while it loads and nothing jumps when the real thing arrives.
 */
export default function Skeleton({ className = '', onFill = false, inline = false }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`${inline ? 'inline-block' : 'block'} ${onFill ? 'skeleton-on-fill' : 'skeleton'} ${className}`}
    />
  );
}
