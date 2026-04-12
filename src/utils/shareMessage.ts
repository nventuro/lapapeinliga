import type { MatchWithDetails, TrainingWithDetails, TournamentWithDetails, EventWithDetails } from '../types';
import { allParticipants } from '../types';
import { formatDateForShare, formatTime } from './dateUtils';
import { perPlayerCost } from './costUtils';

function buildHeader(event: EventWithDetails, eventNumber: string): string[] {
  const lines: string[] = [];
  lines.push('*🏆 La Papeinliga*');
  lines.push('');

  const typeEmoji = event.type === 'match' ? '⚽' : event.type === 'tournament' ? '🏆' : '🏋️';
  const typeLabel = event.type === 'match' ? 'Partido' : event.type === 'tournament' ? 'Torneo' : 'Entrenamiento';
  const namePart = event.name ? ` · ${event.name}` : '';
  lines.push(`Fecha ${eventNumber}${namePart} · ${typeEmoji} ${typeLabel}`);
  lines.push(`📅 ${formatDateForShare(event.played_at)}`);

  lines.push(`🕐 ${formatTime(event.played_at_time)}`);
  if (event.location) {
    lines.push(`📍 ${event.location.name} (${event.location.maps_url})`);
  }

  return lines;
}

function buildCostFooter(event: EventWithDetails): string[] {
  const lines: string[] = [];
  if (event.cost != null) {
    const playerCount = allParticipants(event).length;
    if (playerCount > 0) {
      const cost = perPlayerCost(event.cost, playerCount);
      lines.push('');
      lines.push(`*💰 $${cost} por persona*`);
      lines.push(`Enviar a ${event.payee_alias_cbu!}`);
    }
  }

  lines.push('');
  lines.push('¡Nos vemos en la cancha! ✨🩵');
  return lines;
}

function buildMatchShareMessage(event: MatchWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  for (const team of event.teams) {
    const shirtLabel = team.shirt_color === 'dark' ? 'Oscuros ⚫' : 'Claros ⚪';
    lines.push('');
    lines.push(`${team.name} (${shirtLabel})`);
    const sorted = [...team.players].sort((a, b) => a.name.localeCompare(b.name));
    for (const player of sorted) {
      lines.push(`- ${player.name}`);
    }
  }

  if (event.reserves.length > 0) {
    lines.push('');
    lines.push('🔄 Suplentes');
    const sorted = [...event.reserves].sort((a, b) => a.name.localeCompare(b.name));
    for (const player of sorted) {
      lines.push(`- ${player.name}`);
    }
  }

  lines.push(...buildCostFooter(event));
  return lines.join('\n');
}

function buildTrainingShareMessage(event: TrainingWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  lines.push('');
  lines.push('Jugadores');
  const sortedAttendees = [...event.attendees].sort((a, b) => a.name.localeCompare(b.name));
  for (const player of sortedAttendees) {
    lines.push(`- ${player.name}`);
  }

  lines.push('');
  lines.push('Entrenadores');
  const sortedCoaches = [...event.coaches].sort((a, b) => a.name.localeCompare(b.name));
  for (const coach of sortedCoaches) {
    lines.push(`- ${coach.name}`);
  }

  lines.push(...buildCostFooter(event));
  return lines.join('\n');
}

function buildTournamentShareMessage(event: TournamentWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  for (const team of event.teams) {
    lines.push('');
    lines.push(team.name);
    const sorted = [...team.players].sort((a, b) => a.name.localeCompare(b.name));
    for (const player of sorted) {
      lines.push(`- ${player.name}`);
    }
  }

  if (event.reserves.length > 0) {
    lines.push('');
    lines.push('🔄 Suplentes');
    const sorted = [...event.reserves].sort((a, b) => a.name.localeCompare(b.name));
    for (const player of sorted) {
      lines.push(`- ${player.name}`);
    }
  }

  lines.push(...buildCostFooter(event));
  return lines.join('\n');
}

export function buildEventShareMessage(event: EventWithDetails, eventNumber: string): string {
  if (event.type === 'match') return buildMatchShareMessage(event, eventNumber);
  if (event.type === 'tournament') return buildTournamentShareMessage(event, eventNumber);
  return buildTrainingShareMessage(event, eventNumber);
}

export function openWhatsAppShare(text: string): void {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
