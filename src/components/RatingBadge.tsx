import { MAX_RATING } from '../types';

export default function RatingBadge({ rating, pill = true, className = '' }: {
  rating: number;
  pill?: boolean;
  className?: string;
}) {
  const pillClasses = pill ? 'text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral text-muted-strong' : '';
  return (
    <span className={`${pillClasses} ${className}`}>
      {rating}/{MAX_RATING}
    </span>
  );
}
