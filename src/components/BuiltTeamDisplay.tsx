import type { MatchTeam, AwardType } from '../types';
import { isGuest, comparePlayersByGenderThenName, AWARD_LABELS } from '../types';
import { teamAverageRating } from '../utils/scoring';
import { useAppContext } from '../context/appContext';
import { TrophyIcon, ShirtIcon, GenderMaleIcon, GenderFemaleIcon } from './icons';
import { AWARD_ICONS } from './awardIcons';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import Tooltip from './Tooltip';
import Confetti from './Confetti';

interface BuiltTeamDisplayProps {
  team: MatchTeam;
  isWinner: boolean;
  playerAwards: Map<number, AwardType[]>;
}

export default function BuiltTeamDisplay({ team, isWinner, playerAwards }: BuiltTeamDisplayProps) {
  const { isAdmin, showRatings } = useAppContext();
  const maleCount = team.players.filter((p) => p.gender === 'male').length;
  const femaleCount = team.players.filter((p) => p.gender === 'female').length;

  return (
    <div
      className={`relative rounded-lg p-4 ${
        isWinner ? 'border-2 border-gold bg-gold-subtle' : 'border border-border'
      }`}
    >
      {isWinner && <Confetti />}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isWinner && (
            <Tooltip label="Ganador">
              <TrophyIcon className="w-5 h-5 text-gold" />
            </Tooltip>
          )}
          <h3 className="font-bold text-lg">{team.name}</h3>
          <Tooltip label={team.shirt_color === 'light' ? 'Camiseta clara' : 'Camiseta oscura'}>
            <ShirtIcon
              className={`w-5 h-5 ${team.shirt_color === 'light' ? 'text-shirt-light' : 'text-shirt-dark'}`}
            />
          </Tooltip>
        </div>
        {isAdmin && showRatings && (
          <span className="text-sm text-muted">
            Promedio: {teamAverageRating(team).toFixed(1)}
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {[...team.players].sort(comparePlayersByGenderThenName).map((player) => {
          const awards = playerAwards.get(player.id);
          return (
            <li key={player.id} className="flex items-center gap-2 py-1 px-2">
              <GenderIcon gender={player.gender} />
              <span>{player.name}</span>
              {isGuest(player) && <InvBadge />}
              {awards?.map((award) => {
                const Icon = AWARD_ICONS[award];
                return (
                  <Tooltip key={award} label={AWARD_LABELS[award]} className="text-gold">
                    <Icon className="w-4 h-4" />
                  </Tooltip>
                );
              })}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 pt-2 border-t border-border-subtle text-sm text-muted">
        <span>{team.players.length} jugador{team.players.length !== 1 ? 'es' : ''}</span>
        {' · '}
        <span>
          {maleCount}<GenderMaleIcon className="w-4 h-4 inline" />
        </span>
        {' '}
        <span>
          {femaleCount}<GenderFemaleIcon className="w-4 h-4 inline" />
        </span>
      </div>
    </div>
  );
}
