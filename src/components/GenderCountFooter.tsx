import type { Player } from '../types';
import { GenderMaleIcon, GenderFemaleIcon } from './icons';

/** The "N jugadores · M♂ F♀" footer shown under roster cards. */
export default function GenderCountFooter({ players }: { players: Player[] }) {
  const maleCount = players.filter((p) => p.gender === 'male').length;
  const femaleCount = players.length - maleCount;

  return (
    <div className="mt-2 pt-2 border-t border-border-subtle text-sm text-muted">
      <span>{players.length} jugador{players.length !== 1 ? 'es' : ''}</span>
      {' · '}
      <span>
        {maleCount}<GenderMaleIcon className="w-4 h-4 inline" />
      </span>
      {' '}
      <span>
        {femaleCount}<GenderFemaleIcon className="w-4 h-4 inline" />
      </span>
    </div>
  );
}
