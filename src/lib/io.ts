// Backup export / import and CSV export.

import { todayKey } from './dates';
import type { Data } from './model';
import { normalize } from './store';
import { formatValue } from './values';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJson(data: Data) {
  download(`diarlog-backup-${todayKey()}.json`, JSON.stringify({ app: 'diarlog', exportedAt: new Date().toISOString(), ...data }, null, 2), 'application/json');
}

const csvCell = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** One row per logged value: date, log, period, type, value, raw, edited. */
export function exportCsv(data: Data) {
  const header = ['date', 'log', 'period', 'type', 'value', 'raw', 'edited'];
  const body: string[][] = [];
  const logs = [...data.logs].sort((a, b) => a.order - b.order);
  for (const log of logs) {
    const entries = data.entries[log.id] ?? {};
    for (const key of Object.keys(entries)) {
      const e = entries[key];
      const raw = Array.isArray(e.v) ? e.v.join('|') : String(e.v);
      body.push([key, log.name, log.period, log.type, formatValue(log, e.v), raw, new Date(e.t).toISOString()]);
    }
  }
  body.sort((a, b) => a[0].localeCompare(b[0])); // stable: keeps log order within a date
  const rows = [header, ...body];
  download(`diarlog-values-${todayKey()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}

export async function readBackup(file: File): Promise<Data> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('the file is not valid JSON');
  }
  return normalize(json);
}
