import type { AwardType } from '../types';
import { SoccerBallIcon, ShieldIcon, CrownIcon, GloveIcon, EggIcon, TrophyIcon } from './icons';

export const AWARD_ICONS: Record<AwardType, typeof TrophyIcon> = {
  top_scorer: SoccerBallIcon,
  best_defense: ShieldIcon,
  mvp: CrownIcon,
  best_goalie: GloveIcon,
  most_effort: EggIcon,
};
