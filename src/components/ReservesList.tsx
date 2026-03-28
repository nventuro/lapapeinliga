import type { Player } from '../types';
import { isGuest } from '../types';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';

interface ReservesListProps {
  reserves: Player[];
}

export default function ReservesList({ reserves }: ReservesListProps) {
  if (reserves.length === 0) return null;

  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <h3 className="font-bold text-lg mb-3">
        Suplentes
        <span className="font-normal text-sm text-muted ml-2">
          ({reserves.length})
        </span>
      </h3>
      <ul className="space-y-1">
        {reserves.map((player) => (
          <li key={player.id} className="flex items-center gap-2 py-1 px-2">
            <GenderIcon gender={player.gender} />
            <span>{player.name}</span>
            {isGuest(player) && <InvBadge />}
          </li>
        ))}
      </ul>
    </div>
  );
}
