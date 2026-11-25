// Helpers for "what belongs to this day" (Today page, History day view, calendar).

import { periodEnd, periodStart, startOfMonth, startOfWeek, type DateKey } from './dates';
import type { Data, LogDef, Period } from './model';
import { sortedLogs } from './store';

export function logsOf(data: Data, period: Period): LogDef[] {
  return sortedLogs(data).filter((l) => l.period === period);
}

/** Logs that count for a period: existing by then, or with a value anyway. */
export function countedLogs(data: Data, period: Period, key: DateKey): LogDef[] {
  const end = periodEnd(period, key);
  return logsOf(data, period).filter((l) => l.createdAt <= end || !!data.entries[l.id]?.[key]);
}

export function loggedCount(data: Data, period: Period, key: DateKey): { done: number; total: number } {
  const logs = countedLogs(data, period, key);
  const done = logs.filter((l) => !!data.entries[l.id]?.[key]).length;
  return { done, total: logs.length };
}

export function periodKeyFor(period: Period, date: DateKey): DateKey {
  return periodStart(period, date);
}

export const isWeekStart = (k: DateKey) => startOfWeek(k) === k;
export const isMonthStart = (k: DateKey) => startOfMonth(k) === k;
