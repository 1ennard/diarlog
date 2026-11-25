// Core data model of Diarlog.
//
// A *log* (LogDef) is an instance of a log type ("Water", a Number log).
// An *entry* is the value of one log for one period (day / week / month),
// stored under the period's start date key.

export type LogType = 'checkbox' | 'number' | 'percent' | 'text' | 'choice';
export type Period = 'daily' | 'weekly' | 'monthly';
export type DefaultMode = 'none' | 'fixed' | 'previous';
export type NumberInput = 'stepper' | 'keypad';

/** checkbox → boolean, number/percent → number, text → string, choice → option ids */
export type Value = boolean | number | string | string[];

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface LogDef {
  id: string;
  name: string;
  type: LogType;
  period: Period;
  /** Sort order on the Today page (ascending). */
  order: number;
  /** Date key from which the log is active; defaults are never applied before it. */
  createdAt: string;

  // number
  input?: NumberInput;
  /** Stepper: the value counting starts from when nothing is logged. */
  start?: number;
  step?: number;
  unit?: string;

  // choice
  options?: ChoiceOption[];
  multi?: boolean;

  // default value (what the log shows when nothing is logged)
  defaultMode: DefaultMode;
  defaultValue?: Value;
}

export interface Entry {
  /** value */
  v: Value;
  /** last edit, epoch ms */
  t: number;
}

export type ChartKind = 'line' | 'bar' | 'table';
export type RangeKind = 'week' | 'month' | 'year' | 'custom';
export type Theme = 'system' | 'light' | 'dark';

export interface TrendSettings {
  selected: string[];
  range: RangeKind;
  custom?: { from: string; to: string };
  chart: ChartKind;
  /** Remove periods without a value from the x-axis (instead of bridging them). */
  skipEmpty: boolean;
}

export interface Settings {
  trend: TrendSettings;
  theme: Theme;
}

export interface Data {
  version: 1;
  logs: LogDef[];
  /** logId → period key → entry */
  entries: Record<string, Record<string, Entry>>;
  settings: Settings;
}

export const LOG_TYPES: { type: LogType; label: string }[] = [
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'number', label: 'Number' },
  { type: 'percent', label: 'Percent' },
  { type: 'text', label: 'Text' },
  { type: 'choice', label: 'Choice' },
];

export const PERIODS: { period: Period; label: string }[] = [
  { period: 'daily', label: 'Daily' },
  { period: 'weekly', label: 'Weekly' },
  { period: 'monthly', label: 'Monthly' },
];

export function typeLabel(log: Pick<LogDef, 'type' | 'multi'>): string {
  if (log.type === 'choice') return log.multi ? 'Multiple choice' : 'Single choice';
  return LOG_TYPES.find((t) => t.type === log.type)?.label ?? log.type;
}

export function periodLabel(p: Period): string {
  return PERIODS.find((x) => x.period === p)?.label ?? p;
}

/** Logs that can be drawn in the Trend view (text has no numeric meaning). */
export function isPlottable(log: LogDef): boolean {
  return log.type !== 'text';
}

export function defaultSettings(): Settings {
  return {
    trend: { selected: [], range: 'month', chart: 'line', skipEmpty: false },
    theme: 'system',
  };
}

export function emptyData(): Data {
  return { version: 1, logs: [], entries: {}, settings: defaultSettings() };
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}
