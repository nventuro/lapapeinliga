import type { EventType } from '../types';
import { SoccerBallIcon, BarbellIcon, TrophyIcon, SwordsIcon, ConfettiIcon } from './icons';

/** Icon per event type, so every view showing events picks the same one. */
export const EVENT_TYPE_ICONS: Record<EventType, typeof TrophyIcon> = {
  match: SoccerBallIcon,
  training: BarbellIcon,
  tournament: TrophyIcon,
  external_match: SwordsIcon,
  social: ConfettiIcon,
};
