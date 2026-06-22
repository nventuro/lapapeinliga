import type { MatchWithDetails, TrainingWithDetails, TournamentWithDetails, ExternalMatchWithDetails, EventWithDetails } from '../types';
import { allParticipants, OUR_TEAM_NAME, externalMatchResult } from '../types';
import { formatDateForShare, formatTime } from './dateUtils';
import { perPlayerCost } from './costUtils';

function buildHeader(event: EventWithDetails, eventNumber: string): string[] {
  const lines: string[] = [];
  lines.push('*🏆 La Papeinliga*');
  lines.push('');

  const typeEmoji = event.type === 'match' ? '⚽' : event.type === 'tournament' ? '🏆' : event.type === 'external_match' ? '⚔️' : '🏋️';
  const typeLabel = event.type === 'match' ? 'Partido' : event.type === 'tournament' ? 'Torneo' : event.type === 'external_match' ? 'Partido externo' : 'Entrenamiento';
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

const RESULT_LABELS = { win: 'Ganamos', loss: 'Perdimos', draw: 'Empate' } as const;

function buildExternalMatchShareMessage(event: ExternalMatchWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  lines.push('');
  lines.push(`⚔️ ${OUR_TEAM_NAME} vs ${event.opponent.name}`);
  const result = externalMatchResult(event.externalMatch);
  if (result) {
    lines.push(`Resultado: ${event.externalMatch.our_score} - ${event.externalMatch.their_score} (${RESULT_LABELS[result]})`);
  }

  lines.push('');
  lines.push('Titulares');
  const sortedRoster = [...event.roster].sort((a, b) => a.player.name.localeCompare(b.player.name));
  for (const { player, goals } of sortedRoster) {
    const goalSuffix = goals > 0 ? ` ${'⚽'.repeat(goals)}` : '';
    lines.push(`- ${player.name}${goalSuffix}`);
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
  if (event.type === 'external_match') return buildExternalMatchShareMessage(event, eventNumber);
  return buildTrainingShareMessage(event, eventNumber);
}

export function openWhatsAppShare(text: string): void {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
