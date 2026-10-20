// Formats de data i hora, sempre en zona Europe/Madrid.

export const TZ = 'Europe/Madrid';

/** "2026-12-03" -> "dijous, 3 de desembre de 2026" */
export function formatDayLong(day: string, locale = 'ca'): string {
  const [y, m, d] = day.split('-').map(Number);
  // Migdia UTC: cap canvi d'hora pot moure el dia
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'ca-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(date);
}

/** "10:00:00" -> "10.00" (convenció catalana) */
export function formatTime(t: string, locale = 'ca'): string {
  const [h, m] = t.split(':');
  return locale === 'es' ? `${h}:${m}` : `${h}.${m}`;
}

export function formatDuration(minutes: number, locale = 'ca'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === 'es') return m ? `${h} h y ${m} min` : `${h} h`;
  return m ? `${h} h i ${m} min` : `${h} h`;
}

/** Data d'avui a Madrid en format YYYY-MM-DD */
export function madridToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function formatTimestamp(iso: string, locale = 'ca'): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'ca-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TZ,
  }).format(new Date(iso));
}
