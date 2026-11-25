// Value resolution (entry → default) and formatting.

import { addDays, fmtDayMonth, fmtTime, fmtWeekdayShort, isSameDay, periodStart, toKey, type DateKey } from './dates';
import type { Data, Entry, LogDef, Value } from './model';

export type Source = 'entry' | 'fixed' | 'previous' | 'none';

export interface Resolved {
  value: Value | undefined;
  source: Source;
  entry?: Entry;
  /** for source 'previous': the period key the value was carried over from */
  from?: DateKey;
}

// Sorted entry keys per log, cached by entries-object identity (entries are updated immutably).
const sortedCache = new WeakMap<Record<string, Entry>, string[]>();
export function sortedKeys(entries: Record<string, Entry> | undefined): string[] {
  if (!entries) return [];
  let keys = sortedCache.get(entries);
  if (!keys) {
    keys = Object.keys(entries).sort();
    sortedCache.set(entries, keys);
  }
  return keys;
}

/** Latest key strictly before `k` (binary search). */
export function previousKey(keys: string[], k: string): string | undefined {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] < k) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? keys[lo - 1] : undefined;
}

/** Whether defaults apply for this period: between the log's first period and today's period. */
export function isActivePeriod(log: LogDef, key: DateKey, today: DateKey): boolean {
  return key >= periodStart(log.period, log.createdAt) && key <= periodStart(log.period, today);
}

export function resolve(data: Data, log: LogDef, key: DateKey, today: DateKey): Resolved {
  const logEntries = data.entries[log.id];
  const entry = logEntries?.[key];
  if (entry) return { value: entry.v, source: 'entry', entry };
  if (!isActivePeriod(log, key, today)) return { value: undefined, source: 'none' };
  if (log.defaultMode === 'fixed' && log.defaultValue !== undefined && !isEmptyValue(log.defaultValue)) {
    return { value: log.defaultValue, source: 'fixed' };
  }
  if (log.defaultMode === 'previous') {
    const prev = previousKey(sortedKeys(logEntries), key);
    if (prev) return { value: logEntries![prev].v, source: 'previous', from: prev };
  }
  return { value: undefined, source: 'none' };
}

export function isEmptyValue(v: Value | undefined): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && !Number.isFinite(v));
}

// ---------- numbers ----------

const NNBSP = ' ';

/** "8 432", "11 208", "-1 200", "6" */
export function fmtNumber(n: number): string {
  const s = Math.round(n).toLocaleString('en-GB');
  return s.replace(/,/g, NNBSP);
}

/** Decimal-aware formatting for averages: "6.6", "9 120" */
export function fmtStat(n: number): string {
  if (Math.abs(n) >= 100) return fmtNumber(n);
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Compact axis/hero format: "7.5k", "12.8k", "1.2M" */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (a >= 10_000) return `${trim(n / 1000)}k`;
  return fmtStat(n);
}
/** Always in thousands, for stats next to compact values: "7.9k", "14.6k" */
export function fmtThousands(n: number): string {
  return Math.abs(n) >= 1_000_000 ? `${trim(n / 1_000_000)}M` : `${trim(n / 1000)}k`;
}
function trim(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// ---------- value → text ----------

export function choiceLabels(log: LogDef, v: Value | undefined): string[] {
  if (v === undefined) return [];
  const ids = Array.isArray(v) ? v : [String(v)];
  const opts = log.options ?? [];
  return ids.map((id) => opts.find((o) => o.id === id)?.label).filter((x): x is string => !!x);
}

/** Human readable value, e.g. "6 glasses", "72 %", "Done", "Bad", "Vegetables, Fruit". */
export function formatValue(log: LogDef, v: Value | undefined, opts: { short?: boolean } = {}): string {
  if (v === undefined) return '—';
  switch (log.type) {
    case 'checkbox':
      return v ? 'Done' : 'Not done';
    case 'number': {
      const n = fmtNumber(Number(v));
      return log.unit ? `${n} ${log.unit}` : n;
    }
    case 'percent':
      return `${Math.round(Number(v))} %`;
    case 'choice': {
      const labels = choiceLabels(log, v);
      return labels.length ? labels.join(', ') : 'None';
    }
    case 'text': {
      const s = String(v).replace(/\s+/g, ' ').trim();
      if (opts.short && s.length > 40) return s.slice(0, 38).trimEnd() + '…';
      return s;
    }
  }
}

/** Short default description for card meta: "Default · 0", "Default · No", "Default · previous". */
export function defaultMeta(log: LogDef): string | null {
  if (log.defaultMode === 'previous') return 'Default · previous';
  if (log.defaultMode === 'fixed' && log.defaultValue !== undefined) {
    if (log.type === 'checkbox') return `Default · ${log.defaultValue ? 'Yes' : 'No'}`;
    return `Default · ${formatValue(log, log.defaultValue, { short: true })}`;
  }
  return null;
}

/**
 * Meta text shown on a card: when it was last edited, or that it shows a default value.
 *  - edited today → "21:14"
 *  - edited within the last week → "Mon 21:14"
 *  - older → "16 Nov"
 */
export function editedLabel(t: number, now = new Date(), periodKey?: DateKey): string {
  const d = new Date(t);
  if (isSameDay(d, now)) return fmtTime(d);
  const key = toKey(d);
  // logged on the very day it is about (History view): the time says enough
  if (periodKey && key === periodKey) return fmtTime(d);
  if (key > addDays(toKey(now), -7)) return `${fmtWeekdayShort(key)} ${fmtTime(d)}`;
  return fmtDayMonth(key);
}

export function fullTimestamp(t: number): string {
  const d = new Date(t);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, ${fmtTime(d)}`;
}

export function previousMeta(r: Resolved, log: LogDef, key: DateKey): string {
  if (r.source !== 'previous' || !r.from) return 'Default · previous';
  if (log.period === 'daily' && r.from === addDays(key, -1)) return 'Prefilled from yesterday';
  if (log.period === 'daily') return `Prefilled from ${fmtDayMonth(r.from)}`;
  if (log.period === 'weekly') return 'Prefilled from last week';
  return 'Prefilled from last month';
}

/** Sanitize a value for a given log type (used by import and editing). */
export function coerceValue(log: LogDef, v: unknown): Value | undefined {
  switch (log.type) {
    case 'checkbox':
      return typeof v === 'boolean' ? v : undefined;
    case 'number': {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : undefined;
    }
    case 'percent': {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : undefined;
    }
    case 'text':
      return typeof v === 'string' ? v : undefined;
    case 'choice': {
      const ids = new Set((log.options ?? []).map((o) => o.id));
      const arr = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
      const clean = arr.filter((x): x is string => typeof x === 'string' && ids.has(x));
      return log.multi ? clean : clean[0];
    }
  }
}

/** Number used for plotting a value (checkbox → 0/1, single choice → option position 1…n). */
export function numericValue(log: LogDef, v: Value | undefined): number | undefined {
  if (v === undefined) return undefined;
  switch (log.type) {
    case 'checkbox':
      return v ? 1 : 0;
    case 'number':
    case 'percent':
      return Number(v);
    case 'choice': {
      if (log.multi) return Array.isArray(v) ? v.length : undefined;
      const idx = (log.options ?? []).findIndex((o) => o.id === v);
      return idx >= 0 ? idx + 1 : undefined;
    }
    default:
      return undefined;
  }
}

