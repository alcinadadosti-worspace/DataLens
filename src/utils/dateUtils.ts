/**
 * Parse Brazilian date formats:
 * - "dd/MM/yyyy"
 * - "dd/MM/yyyy HH:mm:ss"
 * - "dd/MM/yyyy HH:mm"
 */
export function parseBRDate(raw: string | undefined | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // Try dd/MM/yyyy HH:mm:ss
  const fullMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (fullMatch) {
    const [, d, mo, y, h, mi, sec] = fullMatch;
    return new Date(+y, +mo - 1, +d, +h, +mi, +sec);
  }

  // Try dd/MM/yyyy HH:mm
  const shortTimeMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (shortTimeMatch) {
    const [, d, mo, y, h, mi] = shortTimeMatch;
    return new Date(+y, +mo - 1, +d, +h, +mi, 0);
  }

  // Try dd/MM/yyyy
  const dateOnlyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dateOnlyMatch) {
    const [, d, mo, y] = dateOnlyMatch;
    return new Date(+y, +mo - 1, +d);
  }

  return null;
}

/**
 * Calculate difference in minutes between two dates.
 * Returns null if either date is invalid.
 */
export function diffInMinutes(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return ms / 60_000;
}

/**
 * Format a Date to dd/MM/yyyy string.
 */
export function formatBRDate(d: Date | null): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Parse cycle string like "06/2026" to a sortable key "2026-06"
 */
export function cycleSortKey(cycle: string): string {
  const m = cycle.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return cycle;
  return `${m[2]}-${m[1]}`;
}
