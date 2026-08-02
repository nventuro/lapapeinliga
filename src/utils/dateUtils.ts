const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Formats an ISO date string (yyyy-mm-dd) as a long es-AR locale date, e.g. "Sábado, 14 de Febrero de 2026". */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const weekday = date.toLocaleDateString('es-AR', { weekday: 'long' });
  const monthName = date.toLocaleDateString('es-AR', { month: 'long' });

  return `${capitalize(weekday)}, ${day} de ${capitalize(monthName)} de ${year}`;
}

/** Formats an ISO date string (yyyy-mm-dd) for sharing, e.g. "Lunes 16 de Febrero". */
export function formatDateForShare(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const weekday = date.toLocaleDateString('es-AR', { weekday: 'long' });
  const monthName = date.toLocaleDateString('es-AR', { month: 'long' });

  return `${capitalize(weekday)} ${day} de ${capitalize(monthName)}`;
}

/** Formats an ISO date string (yyyy-mm-dd) as dd/mm/yyyy. */
export function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/** Formats a time string (HH:MM or HH:MM:SS) as HH:MMhs. */
export function formatTime(timeStr: string): string {
  return `${timeStr.slice(0, 5)}hs`;
}

/** Formats an ISO timestamp as a lowercase es-AR sentence-case datetime, e.g. "sábado 11 de abril a las 20:00hs". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString('es-AR', { weekday: 'long' });
  const day = date.getDate();
  const monthName = date.toLocaleDateString('es-AR', { month: 'long' });
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${weekday} ${day} de ${monthName} a las ${time}hs`;
}

/**
 * Serializes a Date as yyyy-mm-dd using its LOCAL calendar fields. Never use
 * `toISOString().slice(0, 10)` for this: it converts to UTC first, so in
 * Argentina (UTC-3) any time from 21:00 onward yields tomorrow's date.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Every fixture is played in Buenos Aires, so "has it started yet" has to be
 * answered on the club's clock rather than the device's -- otherwise a phone in
 * another timezone moves a matchday in or out of the past. Named zone rather
 * than a fixed -03:00 so it still holds if Argentina brings back DST.
 */
const CLUB_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const CLUB_CLOCK_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Wall-clock date (yyyy-mm-dd) and time (HH:MM) at the club right now. */
function clubWallClock(now: Date): { date: string; time: string } {
  const parts = CLUB_CLOCK_FORMAT.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** Zero-padded fields make lexicographic order match chronological order. */
const stamp = (date: string, time: string) => `${date}T${time.slice(0, 5)}`;

/** True once an event's kickoff has passed on the club's clock. */
export function hasStarted(playedAt: string, playedAtTime: string, now: Date = new Date()): boolean {
  const club = clubWallClock(now);
  return stamp(playedAt, playedAtTime) <= stamp(club.date, club.time);
}

/**
 * Whole days from today at the club to an ISO date -- negative for past dates.
 * Both sides go through Date.UTC so no local DST transition can land the
 * subtraction on 23 or 25 hours and shift the count by a day.
 */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const asUTC = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((asUTC(dateStr) - asUTC(clubWallClock(now).date)) / 86_400_000);
}

/** Human distance to an upcoming ISO date, e.g. "hoy", "mañana", "en 3 días". */
export function relativeDayLabel(dateStr: string, now?: Date): string {
  const days = daysUntil(dateStr, now);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === 7) return 'en una semana';
  return `en ${days} días`;
}

/** Formats an ISO date string (yyyy-mm-dd) as a capitalised month and year, e.g. "Agosto 2026". */
export function formatMonthYear(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${capitalize(date.toLocaleDateString('es-AR', { month: 'long' }))} ${year}`;
}

/** Short weekday and day/month for compact lists, e.g. "Dom 16/8". */
export function formatDayMonthShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return `${capitalize(weekday)} ${day}/${month}`;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Returns true if the string is empty (optional) or a valid HH:MM time (00:00–23:59). */
export function isValidTime(value: string): boolean {
  return value === '' || TIME_REGEX.test(value);
}
