// Local-calendar date helpers. Dates are passed around as ISO date keys
// ("2026-11-24"), which sort lexicographically and are timezone-stable.

import type { Period } from './model';

export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(k: unknown): k is DateKey {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
}

export function todayKey(now = new Date()): DateKey {
  return toKey(now);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(k: DateKey, n: number): DateKey {
  const d = fromKey(k);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toKey(d);
}

export function addYears(k: DateKey, n: number): DateKey {
  return addMonths(k, n * 12);
}

/** Weeks start on Monday (ISO 8601). */
export function startOfWeek(k: DateKey): DateKey {
  const d = fromKey(k);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return toKey(d);
}

export function endOfWeek(k: DateKey): DateKey {
  return addDays(startOfWeek(k), 6);
}

export function startOfMonth(k: DateKey): DateKey {
  return k.slice(0, 8) + '01';
}

export function endOfMonth(k: DateKey): DateKey {
  const d = fromKey(k);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function startOfYear(k: DateKey): DateKey {
  return k.slice(0, 4) + '-01-01';
}

export function endOfYear(k: DateKey): DateKey {
  return k.slice(0, 4) + '-12-31';
}

/** The key that identifies the period (day / week / month) containing `k`. */
export function periodStart(period: Period, k: DateKey): DateKey {
  if (period === 'weekly') return startOfWeek(k);
  if (period === 'monthly') return startOfMonth(k);
  return k;
}

export function periodEnd(period: Period, k: DateKey): DateKey {
  if (period === 'weekly') return endOfWeek(k);
  if (period === 'monthly') return endOfMonth(k);
  return k;
}

export function nextPeriod(period: Period, k: DateKey): DateKey {
  if (period === 'weekly') return addDays(startOfWeek(k), 7);
  if (period === 'monthly') return addMonths(startOfMonth(k), 1);
  return addDays(k, 1);
}

/** All period keys whose period overlaps [from, to]. */
export function periodKeysInRange(period: Period, from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = periodStart(period, from); k <= to; k = nextPeriod(period, k)) out.push(k);
  return out;
}

export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);
}

export function isoWeek(k: DateKey): number {
  const d = fromKey(k);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---------- formatting (en-GB style, as in the design: "Tuesday, 24 November") ----------

const LOCALE = 'en-GB';
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, opts);
    fmtCache.set(key, f);
  }
  return f;
}

/** "Tuesday, 24 November" */
export const fmtLongDate = (k: DateKey) =>
  fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(fromKey(k));
/** "Mon, 16 November" */
export const fmtMediumDate = (k: DateKey) =>
  fmt({ weekday: 'short', day: 'numeric', month: 'long' }).format(fromKey(k));
// en-GB abbreviates September as "Sept"; keep every short month at three letters.
const sep = (s: string) => s.replace('Sept', 'Sep');

/** "16 Nov" */
export const fmtDayMonth = (k: DateKey) => sep(fmt({ day: 'numeric', month: 'short' }).format(fromKey(k)));
/** "16 Nov 2026" */
export const fmtDayMonthYear = (k: DateKey) =>
  sep(fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(fromKey(k)));
/** "November 2026" */
export const fmtMonthYear = (k: DateKey) => fmt({ month: 'long', year: 'numeric' }).format(fromKey(k));
/** "November" */
export const fmtMonth = (k: DateKey) => fmt({ month: 'long' }).format(fromKey(k));
/** "Nov" */
export const fmtMonthShort = (k: DateKey) => sep(fmt({ month: 'short' }).format(fromKey(k)));
/** "Monday" */
export const fmtWeekday = (k: DateKey) => fmt({ weekday: 'long' }).format(fromKey(k));
/** "Mon" */
export const fmtWeekdayShort = (k: DateKey) => fmt({ weekday: 'short' }).format(fromKey(k));
/** "21:14" */
export const fmtTime = (d: Date) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

/** "23 – 29 Nov", "28 Nov – 4 Dec", "28 Dec 2026 – 3 Jan 2027" */
export function fmtRange(from: DateKey, to: DateKey): string {
  const a = fromKey(from);
  const b = fromKey(to);
  if (from === to) return fmtDayMonthYear(from);
  if (a.getFullYear() !== b.getFullYear()) return `${fmtDayMonthYear(from)} – ${fmtDayMonthYear(to)}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${fmtDayMonth(to)}`;
  return `${fmtDayMonth(from)} – ${fmtDayMonth(to)}`;
}

/** Friendly heading for a day relative to today: "Today", "Yesterday", "Monday", "16 Nov". */
export function relativeDayTitle(k: DateKey, today: DateKey): string {
  if (k === today) return 'Today';
  if (k === addDays(today, -1)) return 'Yesterday';
  if (k === addDays(today, 1)) return 'Tomorrow';
  const diff = daysBetween(k, today);
  if (diff > 0 && diff < 7) return fmtWeekday(k);
  return fmtDayMonth(k);
}
