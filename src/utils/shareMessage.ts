import type { MatchdayWithDetails } from '../types';
import { allParticipants } from '../types';
import { formatDateForShare, formatTime } from './dateUtils';
import { perPlayerCost } from './costUtils';

export function buildPreGameMessage(
  matchday: MatchdayWithDetails,
  matchdayNumber: string,
): string {
  const lines: string[] = [];

  lines.push(`⚽ La Papeinliga — Fecha ${matchdayNumber}`);
  lines.push(`📅 ${formatDateForShare(matchday.played_at)}`);

  // Time, location, and payee are guaranteed by the UI (share button is disabled without them)
  lines.push(`🕐 ${formatTime(matchday.played_at_time!)}`);
  lines.push(`📍 ${matchday.location!.name} (${matchday.location!.maps_url})`);


  for (const team of matchday.teams) {
    const shirtLabel = team.shirt_color === 'dark' ? 'Oscuros ⚫' : 'Claros ⚪';
    lines.push('');
    lines.push(`${team.name} (${shirtLabel})`);
    const sorted = [...team.players].sort((a, b) => a.name.localeCompare(b.name));
    for (const player of sorted) {
      lines.push(`- ${player.name}`);
    }
  }

  if (matchday.reserves.length > 0) {
    lines.push('');
    lines.push('🔄 Suplentes');
    const sorted = [...matchday.reserves].sort((a, b) => a.name.localeCompare(b.name));
    for (const player of sorted) {
      lines.push(`- ${player.name}`);
    }
  }

  if (matchday.cost != null) {
    const playerCount = allParticipants(matchday).length;
    if (playerCount > 0) {
      const cost = perPlayerCost(matchday.cost, playerCount);
      lines.push('');
      lines.push(`*💰 $${cost} por persona*`);
      lines.push(`Enviar a ${matchday.payee_alias_cbu!}`);
    }
  }

  lines.push('');
  lines.push('¡Nos vemos en la cancha! ✨🩵');

  return lines.join('\n');
}

export function openWhatsAppShare(text: string): void {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
