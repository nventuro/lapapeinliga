export default function InvBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning ${className}`}>
      INV
    </span>
  );
}
