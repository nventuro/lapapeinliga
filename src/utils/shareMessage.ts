import type { MatchWithDetails, TrainingWithDetails, TournamentWithDetails, ExternalMatchWithDetails, EventTeam, EventType, EventWithDetails, Player, SocialWithDetails } from '../types';
import { allParticipants, compareByName, comparePlayersByGenderThenName, EVENT_TYPE_LABELS, EXTERNAL_RESULT_LABELS, OUR_TEAM_NAME, SHIRT_COLOR_LABELS, externalMatchResult } from '../types';
import { formatDateForShare, formatTime } from './dateUtils';
import { formatPesos, perPlayerCost } from './costUtils';

const TYPE_EMOJI: Record<EventType, string> = {
  match: '⚽',
  training: '🏋️',
  tournament: '🏆',
  external_match: '⚔️',
  social: '🎉',
};

function buildHeader(event: EventWithDetails, eventNumber: string): string[] {
  const lines: string[] = [];
  lines.push('*🏆 La Papeinliga*');
  lines.push('');

  const namePart = event.name ? ` · ${event.name}` : '';
  // "Fecha #N" matches the detail page header — keep them in sync.
  lines.push(`Fecha #${eventNumber}${namePart} · ${TYPE_EMOJI[event.type]} ${EVENT_TYPE_LABELS[event.type]}`);
  lines.push(`📅 ${formatDateForShare(event.played_at)}`);

  lines.push(`🕐 ${formatTime(event.played_at_time)}`);
  const location = locationLine(event);
  if (location) lines.push(location);

  return lines;
}

/** Where it is, with the maps link so the place is one tap away in the chat. */
function locationLine(event: EventWithDetails): string | null {
  return event.location ? `📍 ${event.location.name} (${event.location.maps_url})` : null;
}

/** The per-person share and who to send it to; empty when there is no cost to split. */
function paymentLines(event: EventWithDetails): string[] {
  const cost = event.finances?.cost;
  if (cost == null) return [];
  const perPlayer = perPlayerCost(cost, allParticipants(event).length);
  if (perPlayer == null) return [];
  const lines = [`*💰 ${formatPesos(perPlayer)} por persona*`];
  // A cost can be recorded without a payee; never print "Enviar a null".
  if (event.finances?.payee_alias_cbu) {
    lines.push(`Enviar a ${event.finances.payee_alias_cbu}`);
  }
  return lines;
}

function buildCostFooter(event: EventWithDetails): string[] {
  const payment = paymentLines(event);
  const lines: string[] = payment.length > 0 ? ['', ...payment] : [];

  lines.push('');
  lines.push(event.type === 'social' ? '¡Nos vemos! ✨🩵' : '¡Nos vemos en la cancha! ✨🩵');
  return lines;
}

/** One "- Name" line per player, ordered like the on-screen team cards. */
function teamPlayerLines(players: Player[]): string[] {
  return [...players].sort(comparePlayersByGenderThenName).map((p) => `- ${p.name}`);
}

/** One "- Name" line per player, ordered like the on-screen flat lists. */
function playerLines(players: Player[]): string[] {
  return [...players].sort(compareByName).map((p) => `- ${p.name}`);
}

/** A team's heading: its name, plus the shirt it wears when one is recorded. */
function teamHeading(team: EventTeam): string {
  if (!team.shirt_color) return team.name;
  const { team: label, emoji } = SHIRT_COLOR_LABELS[team.shirt_color];
  return `${team.name} (${label} ${emoji})`;
}

function buildMatchShareMessage(event: MatchWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  for (const team of event.teams) {
    lines.push('');
    lines.push(teamHeading(team));
    lines.push(...teamPlayerLines(team.players));
  }

  if (event.reserves.length > 0) {
    lines.push('');
    lines.push('🔄 Suplentes');
    lines.push(...playerLines(event.reserves));
  }

  lines.push(...buildCostFooter(event));
  return lines.join('\n');
}

function buildTrainingShareMessage(event: TrainingWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  lines.push('');
  lines.push('Jugadores');
  lines.push(...playerLines(event.attendees));

  lines.push('');
  lines.push('Entrenadores');
  lines.push(...playerLines(event.coaches));

  lines.push(...buildCostFooter(event));
  return lines.join('\n');
}

function buildTournamentShareMessage(event: TournamentWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  for (const team of event.teams) {
    lines.push('');
    lines.push(teamHeading(team));
    lines.push(...teamPlayerLines(team.players));
  }

  if (event.reserves.length > 0) {
    lines.push('');
    lines.push('🔄 Suplentes');
    lines.push(...playerLines(event.reserves));
  }

  lines.push(...buildCostFooter(event));
  return lines.join('\n');
}

function buildExternalMatchShareMessage(event: ExternalMatchWithDetails, eventNumber: string): string {
  const lines = buildHeader(event, eventNumber);

  lines.push('');
  lines.push(`⚔️ ${OUR_TEAM_NAME} vs ${event.opponent.name}`);
  const { our_score, their_score, our_penalties, their_penalties } = event.externalMatch;
  const result = externalMatchResult(our_score, their_score, our_penalties, their_penalties);
  if (result) {
    const shootout = our_penalties != null ? ` ${our_penalties} - ${their_penalties}` : '';
    lines.push(`Resultado: ${our_score} - ${their_score} (${EXTERNAL_RESULT_LABELS[result]}${shootout})`);
  }

  // Ordered like the on-screen roster (gender, then name).
  const rosterLines = (entries: ExternalMatchWithDetails['roster']) =>
    [...entries]
      .sort((a, b) => comparePlayersByGenderThenName(a.player, b.player))
      .map(({ player, goals }) => `- ${player.name}${goals > 0 ? ` ${'⚽'.repeat(goals)}` : ''}`);

  lines.push('');
  lines.push('Titulares');
  lines.push(...rosterLines(event.roster));

  if (event.reserves.length > 0) {
    lines.push('');
    lines.push('🔄 Suplentes');
    lines.push(...rosterLines(event.reserves));
  }

  lines.push(...buildCostFooter(event));
  return lines.join('\n');
}

/** A social event has no roster and no cost split: the header says it all. */
function buildSocialShareMessage(event: SocialWithDetails, eventNumber: string): string {
  return [...buildHeader(event, eventNumber), ...buildCostFooter(event)].join('\n');
}

export function buildEventShareMessage(event: EventWithDetails, eventNumber: string): string {
  if (event.type === 'match') return buildMatchShareMessage(event, eventNumber);
  if (event.type === 'tournament') return buildTournamentShareMessage(event, eventNumber);
  if (event.type === 'external_match') return buildExternalMatchShareMessage(event, eventNumber);
  if (event.type === 'social') return buildSocialShareMessage(event, eventNumber);
  return buildTrainingShareMessage(event, eventNumber);
}

/**
 * What the poster image cannot make tappable or copyable: the maps link and
 * the alias/CBU. Goes out as the image's caption; empty when the event has
 * neither.
 */
export function buildEventShareCaption(event: EventWithDetails): string {
  return [locationLine(event), ...paymentLines(event)].filter(Boolean).join('\n');
}

export function openWhatsAppShare(text: string): void {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/**
 * Opens WhatsApp Web with `text` drafted in the composer, for an image to be
 * pasted onto: WhatsApp turns the draft into the image's caption.
 */
export function openWhatsAppWebDraft(text: string): void {
  const url = text ? `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}` : 'https://web.whatsapp.com';
  window.open(url, '_blank', 'noopener');
}
