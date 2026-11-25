import { beforeEach, describe, expect, it } from 'vitest';
import { demoData } from '../src/lib/demo';
import { addLog, clearAll, clearValue, deleteLog, getState, moveLog, normalize, restoreLog, setValue, sortedLogs } from '../src/lib/store';

beforeEach(() => clearAll());

describe('store', () => {
  it('sets and clears values', () => {
    const l = addLog({ name: 'Water', type: 'number', period: 'daily', defaultMode: 'none', createdAt: '2026-11-01' });
    setValue(l.id, '2026-11-20', 7.6);
    expect(getState().entries[l.id]['2026-11-20'].v).toBe(8); // whole numbers
    clearValue(l.id, '2026-11-20');
    expect(getState().entries[l.id]['2026-11-20']).toBeUndefined();
  });

  it('treats empty text as no entry and back-fills createdAt', () => {
    const l = addLog({ name: 'Diary', type: 'text', period: 'daily', defaultMode: 'none', createdAt: '2026-11-10' });
    setValue(l.id, '2026-11-05', 'hello');
    expect(getState().logs[0].createdAt).toBe('2026-11-05');
    setValue(l.id, '2026-11-05', '   ');
    expect(getState().entries[l.id]['2026-11-05']).toBeUndefined();
  });

  it('deletes with undo', () => {
    const l = addLog({ name: 'Mood', type: 'percent', period: 'daily', defaultMode: 'none' });
    setValue(l.id, '2026-11-20', 70);
    const removed = deleteLog(l.id)!;
    expect(getState().logs).toHaveLength(0);
    restoreLog(removed);
    expect(getState().entries[l.id]['2026-11-20'].v).toBe(70);
  });

  it('reorders within a period', () => {
    const a = addLog({ name: 'A', type: 'checkbox', period: 'daily', defaultMode: 'none' });
    addLog({ name: 'W', type: 'checkbox', period: 'weekly', defaultMode: 'none' });
    const b = addLog({ name: 'B', type: 'checkbox', period: 'daily', defaultMode: 'none' });
    moveLog(b.id, -1);
    expect(sortedLogs(getState()).filter((l) => l.period === 'daily').map((l) => l.id)).toEqual([b.id, a.id]);
  });

  it('normalizes imported data and rejects garbage', () => {
    expect(() => normalize({ foo: 1 })).toThrow();
    const demo = demoData('2026-11-25');
    const round = normalize(JSON.parse(JSON.stringify(demo)));
    expect(round.logs).toHaveLength(demo.logs.length);
    const bad = normalize({ logs: [{ id: 'p', name: 'P', type: 'percent', period: 'daily', defaultMode: 'none' }], entries: { p: { '2026-11-01': { v: 140, t: 1 }, nope: { v: 1, t: 1 } } } });
    expect(bad.entries.p).toEqual({ '2026-11-01': { v: 100, t: 1 } });
  });
});
