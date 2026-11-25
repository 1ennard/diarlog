// App state: a tiny external store persisted to localStorage.
// All updates are immutable so React can subscribe with useSyncExternalStore.

import { useSyncExternalStore } from 'react';
import { isDateKey, todayKey } from './dates';
import { defaultSettings, emptyData, uid, type Data, type Entry, type LogDef, type Settings, type Value } from './model';
import { coerceValue, isEmptyValue } from './values';

const STORAGE_KEY = 'diarlog:data:v1';

type Listener = () => void;
let state: Data = load();
const listeners = new Set<Listener>();

function load(): Data {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return normalize(JSON.parse(raw));
  } catch (err) {
    console.error('Diarlog: could not read saved data', err);
  }
  return emptyData();
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let persistRequested = false;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Diarlog: could not save data', err);
  }
  if (!persistRequested && typeof navigator !== 'undefined' && navigator.storage?.persist) {
    persistRequested = true;
    navigator.storage.persist().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  // Keep several open tabs in sync.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      state = normalize(JSON.parse(e.newValue));
      emit();
    } catch {
      /* ignore */
    }
  });
}

function emit() {
  for (const l of listeners) l();
}

function set(next: Data, persist = true) {
  state = next;
  if (persist) scheduleSave();
  emit();
}

export function getState(): Data {
  return state;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useData(): Data {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------- selectors ----------

export function sortedLogs(data: Data): LogDef[] {
  return [...data.logs].sort((a, b) => a.order - b.order);
}

export function getLog(data: Data, id: string): LogDef | undefined {
  return data.logs.find((l) => l.id === id);
}

export function hasEntries(data: Data, id: string): boolean {
  const e = data.entries[id];
  return !!e && Object.keys(e).length > 0;
}

// ---------- actions: logs ----------

export function addLog(def: Omit<LogDef, 'id' | 'order' | 'createdAt'> & Partial<Pick<LogDef, 'createdAt'>>): LogDef {
  const order = state.logs.reduce((m, l) => Math.max(m, l.order), -1) + 1;
  const log: LogDef = { ...def, id: uid(), order, createdAt: def.createdAt ?? todayKey() };
  set({ ...state, logs: [...state.logs, log] });
  return log;
}

export function updateLog(id: string, patch: Partial<LogDef>) {
  set({ ...state, logs: state.logs.map((l) => (l.id === id ? { ...l, ...patch, id } : l)) });
}

export function duplicateLog(id: string): LogDef | undefined {
  const src = getLog(state, id);
  if (!src) return;
  const copy: LogDef = {
    ...structuredClone(src),
    id: uid(),
    name: `${src.name} (copy)`,
    createdAt: todayKey(),
  };
  // place right after the source
  const logs = [...sortedLogs(state)];
  logs.splice(logs.findIndex((l) => l.id === id) + 1, 0, copy);
  set({ ...state, logs: logs.map((l, i) => ({ ...l, order: i })) });
  return copy;
}

export interface DeletedLog {
  log: LogDef;
  entries: Record<string, Entry> | undefined;
  trendSelected: boolean;
}

export function deleteLog(id: string): DeletedLog | undefined {
  const log = getLog(state, id);
  if (!log) return;
  const { [id]: removed, ...entries } = state.entries;
  const trendSelected = state.settings.trend.selected.includes(id);
  set({
    ...state,
    logs: state.logs.filter((l) => l.id !== id),
    entries,
    settings: {
      ...state.settings,
      trend: { ...state.settings.trend, selected: state.settings.trend.selected.filter((x) => x !== id) },
    },
  });
  return { log, entries: removed, trendSelected };
}

export function restoreLog(d: DeletedLog) {
  if (getLog(state, d.log.id)) return;
  set({
    ...state,
    logs: [...state.logs, d.log],
    entries: d.entries ? { ...state.entries, [d.log.id]: d.entries } : state.entries,
    settings: d.trendSelected
      ? { ...state.settings, trend: { ...state.settings.trend, selected: [...state.settings.trend.selected, d.log.id] } }
      : state.settings,
  });
}

/** Move a log one step up/down among the logs of the same period. */
export function moveLog(id: string, dir: -1 | 1) {
  const logs = sortedLogs(state);
  const log = logs.find((l) => l.id === id);
  if (!log) return;
  const same = logs.filter((l) => l.period === log.period);
  const i = same.indexOf(log);
  const other = same[i + dir];
  if (!other) return;
  set({
    ...state,
    logs: state.logs.map((l) =>
      l.id === log.id ? { ...l, order: other.order } : l.id === other.id ? { ...l, order: log.order } : l,
    ),
  });
}

// ---------- actions: values ----------

export function setValue(logId: string, key: string, value: Value) {
  const log = getLog(state, logId);
  if (!log) return;
  const v = coerceValue(log, value);
  if (v === undefined || (log.type === 'text' && isEmptyValue(v))) {
    clearValue(logId, key);
    return;
  }
  const logEntries = { ...(state.entries[logId] ?? {}), [key]: { v, t: Date.now() } };
  // Back-filling before the log existed makes it active from that period on.
  const logs = key < log.createdAt ? state.logs.map((l) => (l.id === logId ? { ...l, createdAt: key } : l)) : state.logs;
  set({ ...state, logs, entries: { ...state.entries, [logId]: logEntries } });
}

export function clearValue(logId: string, key: string) {
  const cur = state.entries[logId];
  if (!cur || !(key in cur)) return;
  const { [key]: _removed, ...rest } = cur;
  void _removed;
  set({ ...state, entries: { ...state.entries, [logId]: rest } });
}

// ---------- actions: settings ----------

export function updateSettings(patch: Partial<Settings>) {
  set({ ...state, settings: { ...state.settings, ...patch } });
}

export function updateTrend(patch: Partial<Settings['trend']>) {
  set({ ...state, settings: { ...state.settings, trend: { ...state.settings.trend, ...patch } } });
}

// ---------- whole-data actions ----------

export function replaceData(next: Data) {
  set(normalize(next));
  flush();
}

export function clearAll() {
  set({ ...emptyData(), settings: { ...defaultSettings(), theme: state.settings.theme } });
  flush();
}

/** Validate / repair data coming from storage or an import file. Throws on garbage. */
export function normalize(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Diarlog backup');
  const r = raw as Partial<Data>;
  if (!Array.isArray(r.logs)) throw new Error('Not a Diarlog backup (no logs)');
  const types = ['checkbox', 'number', 'percent', 'text', 'choice'];
  const periods = ['daily', 'weekly', 'monthly'];
  const logs: LogDef[] = r.logs
    .filter((l): l is LogDef => !!l && typeof l === 'object' && typeof l.id === 'string' && types.includes(l.type))
    .map((l, i) => ({
      ...l,
      name: String(l.name ?? 'Untitled'),
      period: periods.includes(l.period) ? l.period : 'daily',
      order: Number.isFinite(l.order) ? l.order : i,
      createdAt: isDateKey(l.createdAt) ? l.createdAt : todayKey(),
      defaultMode: ['none', 'fixed', 'previous'].includes(l.defaultMode) ? l.defaultMode : 'none',
      options: l.type === 'choice' ? (Array.isArray(l.options) ? l.options : []) : l.options,
    }));
  const entries: Data['entries'] = {};
  const rawEntries = (r.entries ?? {}) as Record<string, Record<string, Entry>>;
  for (const log of logs) {
    const src = rawEntries[log.id];
    if (!src || typeof src !== 'object') continue;
    const out: Record<string, Entry> = {};
    for (const [k, e] of Object.entries(src)) {
      if (!isDateKey(k) || !e || typeof e !== 'object') continue;
      const v = coerceValue(log, (e as Entry).v);
      if (v === undefined) continue;
      out[k] = { v, t: Number((e as Entry).t) || Date.now() };
    }
    entries[log.id] = out;
  }
  const base = defaultSettings();
  const s = (r.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    trend: { ...base.trend, ...(s.trend ?? {}) },
  };
  settings.trend.selected = (settings.trend.selected ?? []).filter((id) => logs.some((l) => l.id === id));
  return { version: 1, logs, entries, settings };
}
