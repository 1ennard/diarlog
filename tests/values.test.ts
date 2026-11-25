import { describe, expect, it } from 'vitest';
import { emptyData, type Data, type LogDef } from '../src/lib/model';
import { editedLabel, fmtNumber, formatValue, previousKey, resolve } from '../src/lib/values';

const log = (p: Partial<LogDef>): LogDef => ({
  id: 'x',
  name: 'X',
  type: 'number',
  period: 'daily',
  order: 0,
  createdAt: '2026-11-01',
  defaultMode: 'none',
  ...p,
});

function dataWith(l: LogDef, entries: Record<string, unknown>): Data {
  const d = emptyData();
  d.logs = [l];
  d.entries[l.id] = Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, { v: v as never, t: 0 }]));
  return d;
}

const TODAY = '2026-11-25';

describe('resolve', () => {
  it('prefers a logged entry', () => {
    const l = log({ defaultMode: 'fixed', defaultValue: 0 });
    expect(resolve(dataWith(l, { '2026-11-20': 5 }), l, '2026-11-20', TODAY)).toMatchObject({ value: 5, source: 'entry' });
  });

  it('falls back to a fixed default only inside the active window', () => {
    const l = log({ defaultMode: 'fixed', defaultValue: 0 });
    const d = dataWith(l, {});
    expect(resolve(d, l, '2026-11-20', TODAY)).toMatchObject({ value: 0, source: 'fixed' });
    expect(resolve(d, l, '2026-10-31', TODAY).source).toBe('none'); // before the log existed
    expect(resolve(d, l, '2026-11-26', TODAY).source).toBe('none'); // the future
  });

  it('carries the previous value forward', () => {
    const l = log({ type: 'percent', defaultMode: 'previous' });
    const d = dataWith(l, { '2026-11-10': 60, '2026-11-20': 72 });
    expect(resolve(d, l, '2026-11-24', TODAY)).toMatchObject({ value: 72, source: 'previous', from: '2026-11-20' });
    expect(resolve(d, l, '2026-11-15', TODAY)).toMatchObject({ value: 60, from: '2026-11-10' });
    expect(resolve(d, l, '2026-11-05', TODAY).source).toBe('none');
  });

  it('uses weekly period keys', () => {
    const l = log({ period: 'weekly', defaultMode: 'fixed', defaultValue: 1, createdAt: '2026-11-25' });
    // created on a Wednesday: that whole week is active
    expect(resolve(dataWith(l, {}), l, '2026-11-23', TODAY).source).toBe('fixed');
    expect(resolve(dataWith(l, {}), l, '2026-11-16', TODAY).source).toBe('none');
  });
});

describe('formatting', () => {
  it('groups thousands with a narrow space', () => {
    expect(fmtNumber(8432)).toBe('8 432');
    expect(fmtNumber(6)).toBe('6');
  });

  it('formats values per type', () => {
    expect(formatValue(log({ unit: 'glasses' }), 6)).toBe('6 glasses');
    expect(formatValue(log({ type: 'percent' }), 72)).toBe('72 %');
    expect(formatValue(log({ type: 'checkbox' }), true)).toBe('Done');
    const choice = log({ type: 'choice', multi: true, options: [{ id: 'a', label: 'Fruit' }, { id: 'b', label: 'Coffee' }] });
    expect(formatValue(choice, ['b', 'a'])).toBe('Coffee, Fruit');
  });

  it('labels edit times relative to now', () => {
    const now = new Date(2026, 10, 25, 22, 0);
    expect(editedLabel(new Date(2026, 10, 25, 21, 14).getTime(), now)).toBe('21:14');
    expect(editedLabel(new Date(2026, 10, 23, 9, 5).getTime(), now)).toBe('Mon 09:05');
    expect(editedLabel(new Date(2026, 10, 2, 9, 5).getTime(), now)).toBe('2 Nov');
    expect(editedLabel(new Date(2026, 10, 2, 9, 5).getTime(), now, '2026-11-02')).toBe('09:05');
  });

  it('finds the previous key by binary search', () => {
    const keys = ['2026-11-01', '2026-11-05', '2026-11-09'];
    expect(previousKey(keys, '2026-11-05')).toBe('2026-11-01');
    expect(previousKey(keys, '2026-11-30')).toBe('2026-11-09');
    expect(previousKey(keys, '2026-10-01')).toBeUndefined();
  });
});
