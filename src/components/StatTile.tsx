import Skeleton from './Skeleton';

/** A single headline number with its label. Used for a player's record and for
 *  the league totals, so it lives here rather than inside either page. */
export default function StatTile({
  value,
  label,
  accent = false,
}: {
  /** Null while the number is still loading. */
  value: string | null;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg py-3 px-2 text-center">
      {value === null ? (
        <Skeleton className="h-5 w-8 mx-auto rounded" />
      ) : (
        <p className={`font-display text-xl leading-none ${accent ? 'text-accent' : 'text-on-surface'}`}>
          {value}
        </p>
      )}
      <p className="text-xs text-muted mt-1.5">{label}</p>
    </div>
  );
}
