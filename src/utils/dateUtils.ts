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
