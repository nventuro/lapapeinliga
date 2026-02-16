/** Formats an ISO date string (yyyy-mm-dd) as a long es-AR locale date, e.g. "Sábado, 14 de Febrero de 2026". */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const weekday = date.toLocaleDateString('es-AR', { weekday: 'long' });
  const monthName = date.toLocaleDateString('es-AR', { month: 'long' });
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return `${capitalize(weekday)}, ${day} de ${capitalize(monthName)} de ${year}`;
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

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Returns true if the string is empty (optional) or a valid HH:MM time (00:00–23:59). */
export function isValidTime(value: string): boolean {
  return value === '' || TIME_REGEX.test(value);
}
