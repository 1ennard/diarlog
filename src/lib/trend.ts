// Turns entries into plot-ready series for the Trend view.

import {
  addDays,
  addMonths,
  addYears,
  daysBetween,
  endOfMonth,
  endOfWeek,
  endOfYear,
  fmtDayMonth,
  fmtMediumDate,
  fmtMonth,
  fmtMonthShort,
  fmtRange,
  fmtWeekdayShort,
  fromKey,
  periodEnd,
  periodKeysInRange,
  startOfMonth,
  startOfWeek,
  startOfYear,
  type DateKey,
} from './dates';
import type { ChartKind, Data, LogDef, RangeKind } from './model';
import { fmtCompact, fmtNumber, fmtStat, fmtThousands, formatValue, numericValue, resolve } from './values';

// ---------- ranges ----------

export interface DateRange {
  from: DateKey;
  to: DateKey;
}

export function computeRange(kind: RangeKind, anchor: DateKey, today: DateKey, custom?: DateRange): DateRange {
  let from: DateKey;
  let to: DateKey;
  switch (kind) {
    case 'week':
      from = startOfWeek(anchor);
      to = endOfWeek(anchor);
      break;
    case 'month':
      from = startOfMonth(anchor);
      to = endOfMonth(anchor);
      break;
    case 'year':
      from = startOfYear(anchor);
      to = endOfYear(anchor);
      break;
    case 'custom':
      from = custom?.from ?? addDays(today, -29);
      to = custom?.to ?? today;
      if (from > to) [from, to] = [to, from];
      break;
  }
  if (to > today) to = today < from ? from : today;
  return { from, to };
}

/** Move the anchor (or the custom range) one range-length back or forward. */
export function shiftRange(kind: RangeKind, anchor: DateKey, dir: -1 | 1, custom?: DateRange): { anchor: DateKey; custom?: DateRange } {
  switch (kind) {
    case 'week':
      return { anchor: addDays(anchor, 7 * dir) };
    case 'month':
      return { anchor: addMonths(anchor, dir) };
    case 'year':
      return { anchor: addYears(anchor, dir) };
    case 'custom': {
      if (!custom) return { anchor };
      const len = daysBetween(custom.from, custom.to) + 1;
      return { anchor, custom: { from: addDays(custom.from, len * dir), to: addDays(custom.to, len * dir) } };
    }
  }
}

export function rangeLabel(r: DateRange): string {
  return fmtRange(r.from, r.to);
}

// ---------- series ----------

export type Bucket = 'day' | 'week' | 'month';
export type SeriesKind = 'numeric' | 'percent' | 'rate' | 'ordinal' | 'multi';

export interface SeriesPoint {
  key: DateKey;
  end: DateKey;
  /** plotted number (checkbox: 0/1, or a rate 0–100 when aggregated) */
  value?: number;
  /** checkbox only: rolling done-rate (0–100) */
  rate?: number;
  /** text for tooltips / table */
  display: string;
}

export interface FreqRow {
  id: string;
  label: string;
  count: number;
  pct: number;
}

export interface Series {
  log: LogDef;
  kind: SeriesKind;
  bucket: Bucket;
  aggregated: boolean;
  points: SeriesPoint[];
  hero: string;
  stats: string;
  /** choice logs: how often each option was picked */
  freq?: FreqRow[];
  /** checkbox: window used for the rolling rate */
  rateWindow?: number;
}

const AGGREGATE_AFTER_DAYS = 92;

export function bucketFor(log: LogDef, range: DateRange): { bucket: Bucket; aggregated: boolean } {
  if (log.period === 'monthly') return { bucket: 'month', aggregated: false };
  if (log.period === 'weekly') return { bucket: 'week', aggregated: false };
  const days = daysBetween(range.from, range.to) + 1;
  return days > AGGREGATE_AFTER_DAYS ? { bucket: 'week', aggregated: true } : { bucket: 'day', aggregated: false };
}

const unitWord = (b: Bucket, n: number) => `${b}${n === 1 ? '' : 's'}`;

export function buildSeries(data: Data, log: LogDef, range: DateRange, today: DateKey): Series {
  const { bucket, aggregated } = bucketFor(log, range);
  const kind: SeriesKind =
    log.type === 'checkbox' ? 'rate' : log.type === 'percent' ? 'percent' : log.type === 'choice' ? (log.multi ? 'multi' : 'ordinal') : 'numeric';

  // raw values per log period
  const keys = periodKeysInRange(log.period, range.from, range.to);
  const raw = keys.map((k) => {
    const r = resolve(data, log, k, today);
    return { key: k, value: r.value, num: numericValue(log, r.value) };
  });

  let points: SeriesPoint[];
  if (aggregated) {
    // daily log over a long range → weekly averages (checkbox: weekly done-rate)
    const groups = new Map<DateKey, number[]>();
    for (const p of raw) {
      const wk = startOfWeek(p.key);
      if (!groups.has(wk)) groups.set(wk, []);
      if (p.num !== undefined) groups.get(wk)!.push(p.num);
    }
    points = [...groups.entries()].map(([k, nums]) => {
      const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
      const value = avg === undefined ? undefined : kind === 'rate' ? avg * 100 : avg;
      let display = '—';
      if (value !== undefined) {
        if (kind === 'rate') display = `${Math.round(value)} % done`;
        else if (kind === 'percent') display = `avg ${Math.round(value)} %`;
        else if (kind === 'ordinal') display = `avg ${fmtStat(value)}`;
        else display = `avg ${fmtStat(value)}${log.unit ? ' ' + log.unit : ''}`;
      }
      return { key: k, end: endOfWeek(k), value, rate: kind === 'rate' ? value : undefined, display };
    });
  } else {
    points = raw.map((p) => ({
      key: p.key,
      end: periodEnd(log.period, p.key),
      value: p.num,
      display: p.value === undefined ? '—' : formatValue(log, p.value, { short: true }),
    }));
  }

  // rolling done-rate for checkboxes
  let rateWindow: number | undefined;
  if (kind === 'rate' && !aggregated) {
    rateWindow = bucket === 'day' ? 7 : bucket === 'week' ? 4 : 3;
    const allKeys = periodKeysInRange(log.period, shiftBack(log, range.from, rateWindow - 1), range.to);
    const nums = allKeys.map((k) => numericValue(log, resolve(data, log, k, today).value));
    const offset = allKeys.length - points.length;
    points.forEach((p, i) => {
      if (p.value === undefined) return;
      const win = nums.slice(Math.max(0, i + offset - rateWindow! + 1), i + offset + 1).filter((n): n is number => n !== undefined);
      p.rate = win.length ? (win.reduce((a, b) => a + b, 0) / win.length) * 100 : undefined;
    });
  }

  // stats & hero
  const vals = points.map((p) => p.value).filter((n): n is number => n !== undefined);
  const logged = raw.filter((p) => p.value !== undefined);
  let hero = '—';
  let stats = 'No data in this range';
  let freq: FreqRow[] | undefined;

  if (kind === 'numeric' || kind === 'percent') {
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const u = kind === 'percent' ? ' %' : '';
      const big = Math.max(Math.abs(min), Math.abs(max)) >= 10_000;
      const f = kind === 'percent' ? (n: number) => String(Math.round(n)) : big ? fmtThousands : fmtStat;
      stats = `avg ${f(avg)}${u} · min ${f(min)}${u} · max ${f(max)}${u}`;
      const last = [...points].reverse().find((p) => p.value !== undefined)!.value!;
      hero = kind === 'percent' ? `${Math.round(last)} %` : Math.abs(last) >= 10_000 ? fmtCompact(last) : fmtNumber(last);
    }
  } else if (kind === 'rate') {
    const nums = logged.map((p) => p.num!).filter((n) => n !== undefined);
    if (nums.length) {
      const done = nums.filter((n) => n === 1).length;
      hero = `${Math.round((done / nums.length) * 100)} %`;
      stats = `done ${done} of ${nums.length} ${unitWord(log.period === 'daily' ? 'day' : log.period === 'weekly' ? 'week' : 'month', nums.length)}`;
    }
  } else {
    // choice
    const counts = new Map<string, number>();
    for (const p of logged) {
      const ids = Array.isArray(p.value) ? p.value : [String(p.value)];
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const n = logged.length;
    freq = (log.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      count: counts.get(o.id) ?? 0,
      pct: n ? ((counts.get(o.id) ?? 0) / n) * 100 : 0,
    }));
    if (n) {
      const top = [...freq].sort((a, b) => b.count - a.count)[0];
      hero = top.count ? top.label : '—';
      const pw = log.period === 'daily' ? 'day' : log.period === 'weekly' ? 'week' : 'month';
      stats = log.multi
        ? `logged ${n} ${unitWord(pw, n)}`
        : `most often · ${top.count} of ${n} ${unitWord(pw, n)}`;
    }
  }

  return { log, kind, bucket, aggregated, points, hero, stats, freq, rateWindow };
}

function shiftBack(log: LogDef, k: DateKey, n: number): DateKey {
  if (log.period === 'weekly') return addDays(k, -7 * n);
  if (log.period === 'monthly') return addMonths(k, -n);
  return addDays(k, -n);
}

export function seriesTitle(s: Series): string {
  if (s.kind === 'rate' && s.rateWindow) {
    const w = s.bucket === 'day' ? `${s.rateWindow}-day` : s.bucket === 'week' ? `${s.rateWindow}-week` : `${s.rateWindow}-month`;
    return `${s.log.name} · ${w} rate`;
  }
  if (s.aggregated && s.kind !== 'multi') return `${s.log.name} · weekly ${s.kind === 'rate' ? 'rate' : 'avg'}`;
  return s.log.name;
}

// ---------- chart preparation ----------

export interface ChartDatum {
  key: DateKey;
  y?: number;
  tipDate: string;
  tipValue: string;
}

export interface AxisTick {
  v: number;
  label: string;
}

export interface ChartModel {
  data: ChartDatum[];
  yMin: number;
  yMax: number;
  yTicks: AxisTick[];
  xTicks: { i: number; label: string }[];
  integer: boolean;
}

export function niceAxis(lo: number, hi: number, integer: boolean, targetSteps = 2): { min: number; max: number; step: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, step: 1 };
  if (hi === lo) {
    hi = lo === 0 ? 1 : lo + Math.abs(lo) * 0.5;
    if (lo > 0 && integer) lo = 0;
  }
  const raw = (hi - lo) / targetSteps;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  let step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  if (integer) step = Math.max(1, Math.ceil(step));
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  return { min, max: max === min ? min + step : max, step };
}

function tipDate(s: Series, key: DateKey, end: DateKey): string {
  if (s.bucket === 'day') return fmtMediumDate(key);
  if (s.bucket === 'month') return `${fmtMonth(key)} ${key.slice(0, 4)}`;
  return fmtRange(key, end);
}

export function chartModel(s: Series, chart: Exclude<ChartKind, 'table'>, skipEmpty: boolean, rangeKind: RangeKind): ChartModel {
  const useRate = s.kind === 'rate' && chart === 'line';
  let data: ChartDatum[] = s.points.map((p) => {
    let y: number | undefined = p.value;
    let tipValue = p.display;
    if (s.kind === 'rate') {
      if (useRate) {
        y = p.rate;
        if (p.rate !== undefined && !s.aggregated) tipValue = `${p.display} · ${Math.round(p.rate)} % ${s.rateWindow}-${s.bucket} rate`;
      } else if (!s.aggregated && p.value !== undefined) {
        y = p.value * 100;
      }
    }
    return { key: p.key, y, tipDate: tipDate(s, p.key, p.end), tipValue };
  });
  if (skipEmpty) data = data.filter((d) => d.y !== undefined);

  // y axis
  const ys = data.map((d) => d.y).filter((n): n is number => n !== undefined);
  let yMin: number;
  let yMax: number;
  let yTicks: AxisTick[];
  if (s.kind === 'rate') {
    yMin = 0;
    yMax = 100;
    yTicks = [0, 50, 100].map((v) => ({ v, label: `${v} %` }));
  } else if (s.kind === 'ordinal') {
    const n = s.log.options?.length ?? 1;
    yMin = chart === 'bar' ? 0 : 1;
    yMax = Math.max(n, 2);
    yTicks = (s.log.options ?? []).map((o, i) => ({ v: i + 1, label: o.label }));
  } else if (s.kind === 'percent') {
    if (chart === 'bar' || !ys.length) {
      yMin = 0;
      yMax = 100;
    } else {
      const a = niceAxis(Math.min(...ys), Math.max(...ys), true);
      yMin = Math.max(0, a.min);
      yMax = Math.min(100, a.max);
      if (yMax - yMin < 20) {
        yMin = Math.max(0, yMin - 10);
        yMax = Math.min(100, yMax + 10);
      }
    }
    const mid = Math.round((yMin + yMax) / 2);
    yTicks = [yMin, mid, yMax].map((v) => ({ v, label: `${v} %` }));
  } else {
    const lo = Math.min(0, ...ys);
    const hi = ys.length ? Math.max(...ys) : 1;
    const a = niceAxis(lo, hi, !s.aggregated);
    yMin = a.min;
    yMax = a.max;
    yTicks = [];
    for (let v = a.min; v <= a.max + 1e-9; v += a.step) yTicks.push({ v, label: Math.abs(a.max) >= 10_000 ? fmtCompact(v) : fmtStat(v) });
  }

  return { data, yMin, yMax, yTicks, xTicks: xTicks(s, data, skipEmpty, rangeKind), integer: s.kind !== 'percent' };
}

/** Choose x-axis tick positions and labels. `maxTicks` is decided later by width; here we produce candidates. */
function xTicks(s: Series, data: ChartDatum[], skipEmpty: boolean, rangeKind: RangeKind): { i: number; label: string }[] {
  const n = data.length;
  if (!n) return [];
  const out: { i: number; label: string }[] = [];
  if (skipEmpty) {
    // ordinal axis: evenly spaced indices, always full day+month labels
    const count = Math.min(n, 5);
    const step = count > 1 ? (n - 1) / (count - 1) : 1;
    const seen = new Set<number>();
    for (let j = 0; j < count; j++) {
      const i = Math.round(j * step);
      if (seen.has(i)) continue;
      seen.add(i);
      out.push({ i, label: s.bucket === 'month' ? fmtMonthShort(data[i].key) : fmtDayMonth(data[i].key) });
    }
    return out;
  }
  if (s.bucket === 'day') {
    if (rangeKind === 'week' || n <= 7) {
      data.forEach((d, i) => out.push({ i, label: fmtWeekdayShort(d.key) }));
      return out;
    }
    const step = n <= 14 ? 2 : n <= 45 ? 7 : 14;
    let lastMonth = -1;
    for (let i = 0; i < n; i += step) {
      const d = fromKey(data[i].key);
      const label = d.getMonth() !== lastMonth ? fmtDayMonth(data[i].key) : String(d.getDate());
      lastMonth = d.getMonth();
      out.push({ i, label });
    }
    return out;
  }
  if (s.bucket === 'week') {
    if (n <= 6) {
      data.forEach((d, i) => out.push({ i, label: fmtDayMonth(d.key) }));
      return out;
    }
    // label weeks that start a new month
    let lastMonth = -1;
    const months: { i: number; label: string }[] = [];
    data.forEach((d, i) => {
      const m = fromKey(addDays(d.key, 3)).getMonth(); // the month most of the week lies in
      if (m !== lastMonth) months.push({ i, label: fmtMonthShort(addDays(d.key, 3)) });
      lastMonth = m;
    });
    const step = months.length > 7 ? 2 : 1;
    return months.filter((_, j) => j % step === 0);
  }
  // month buckets
  const step = n > 8 ? 2 : 1;
  for (let i = 0; i < n; i += step) out.push({ i, label: fmtMonthShort(data[i].key) });
  return out;
}

// ---------- table ----------

export function tableRows(s: Series): { date: string; value: string }[] {
  return [...s.points]
    .reverse()
    .filter((p) => p.value !== undefined)
    .map((p) => ({ date: tipDate(s, p.key, p.end), value: p.display }));
}

