import type { ISODate } from '../types';

const DAY = 86_400_000;
export const toDate = (d: ISODate) => new Date(d + 'T00:00:00Z');
export const iso = (d: Date): ISODate => d.toISOString().slice(0, 10);
export const addDays = (d: ISODate, n: number): ISODate => iso(new Date(toDate(d).getTime() + n * DAY));
export const diffDays = (a: ISODate, b: ISODate) => Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY);
export const todayISO = (): ISODate => iso(new Date());
export const isValidISODate = (s: unknown): s is ISODate =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime()) && iso(toDate(s)) === s;

/** Monday of the ISO week containing d. */
export const weekStart = (d: ISODate): ISODate => {
  const dt = toDate(d);
  const dow = (dt.getUTCDay() + 6) % 7;
  return addDays(d, -dow);
};
export const monthStart = (d: ISODate): ISODate => d.slice(0, 8) + '01';
export const monthEnd = (d: ISODate): ISODate => {
  const dt = toDate(monthStart(d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  return addDays(iso(dt), -1);
};
export const fmtDate = (d?: ISODate | null) => {
  if (!d) return '—';
  const dt = toDate(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
export const fmtShort = (d: ISODate) =>
  toDate(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/**
 * Parse a loosely formatted date from imported files.
 * Accepts ISO, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, Excel serials, JS Date and "12 Mar 2026".
 */
export function parseLooseDate(v: unknown): ISODate | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : iso(v);
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return iso(new Date(Date.UTC(1899, 11, 30) + v * DAY)); // Excel serial
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return norm(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return norm(+m[3], +m[2], +m[1]); // day-first (UK / ME convention)
  const t = Date.parse(s + (/\d{4}$/.test(s) ? ' UTC' : ''));
  if (!Number.isNaN(t)) return iso(new Date(t));
  return null;
}
function norm(y: number, m: number, d: number): ISODate | null {
  const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isValidISODate(s) ? s : null;
}
