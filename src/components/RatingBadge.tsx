import { MAX_RATING, DEFAULT_UNRATED_RATING } from '../types';

export default function RatingBadge({ rating, pill = true, className = '' }: {
  rating: number | null;
  pill?: boolean;
  className?: string;
}) {
  const isUnrated = rating === null;
  const pillClasses = pill ? 'text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral text-muted-strong' : '';
  return (
    <span className={`${pillClasses} ${isUnrated ? 'italic opacity-60' : ''} ${className}`}>
      {isUnrated ? DEFAULT_UNRATED_RATING : rating}/{MAX_RATING}
    </span>
  );
}
