import { describe, expect, it } from 'vitest';
import { emptyData, type Data, type LogDef } from '../src/lib/model';
import { buildSeries, chartModel, computeRange, niceAxis, shiftRange } from '../src/lib/trend';

const TODAY = '2026-11-25';

function setup(l: Partial<LogDef>, entries: Record<string, unknown>): { data: Data; log: LogDef } {
  const log: LogDef = { id: 'l', name: 'L', type: 'number', period: 'daily', order: 0, createdAt: '2026-01-01', defaultMode: 'none', ...l };
  const data = emptyData();
  data.logs = [log];
  data.entries.l = Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, { v: v as never, t: 0 }]));
  return { data, log };
}

describe('ranges', () => {
  it('clips the current month to today', () => {
    expect(computeRange('month', TODAY, TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-25' });
    expect(computeRange('week', TODAY, TODAY)).toEqual({ from: '2026-11-23', to: '2026-11-25' });
    expect(computeRange('month', '2026-10-10', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('shifts custom ranges by their length', () => {
    const r = shiftRange('custom', TODAY, -1, { from: '2026-11-11', to: '2026-11-20' });
    expect(r.custom).toEqual({ from: '2026-11-01', to: '2026-11-10' });
  });
});

describe('series', () => {
  const range = { from: '2026-11-01', to: '2026-11-07' };

  it('bridges empty days by default and removes them with skipEmpty', () => {
    const { data, log } = setup({}, { '2026-11-01': 4, '2026-11-03': 6, '2026-11-07': 8 });
    const s = buildSeries(data, log, range, TODAY);
    expect(s.points).toHaveLength(7);
    expect(s.stats).toBe('avg 6 · min 4 · max 8');
    expect(s.hero).toBe('8');
    const full = chartModel(s, 'line', false, 'week');
    expect(full.data).toHaveLength(7);
    expect(full.data.filter((d) => d.y !== undefined)).toHaveLength(3);
    const skipped = chartModel(s, 'line', true, 'week');
    expect(skipped.data.map((d) => d.key)).toEqual(['2026-11-01', '2026-11-03', '2026-11-07']);
  });

  it('counts a fixed default as a value', () => {
    const { data, log } = setup({ defaultMode: 'fixed', defaultValue: 0 }, { '2026-11-02': 3 });
    const s = buildSeries(data, log, range, TODAY);
    expect(s.points.every((p) => p.value !== undefined)).toBe(true);
    expect(s.stats).toBe('avg 0.4 · min 0 · max 3');
  });

  it('turns checkboxes into a done-rate', () => {
    const { data, log } = setup({ type: 'checkbox' }, { '2026-11-01': true, '2026-11-02': false, '2026-11-03': true, '2026-11-04': true });
    const s = buildSeries(data, log, range, TODAY);
    expect(s.hero).toBe('75 %');
    expect(s.stats).toBe('done 3 of 4 days');
    expect(s.points[3].rate).toBe(75);
    const bars = chartModel(s, 'bar', false, 'week');
    expect(bars.data.slice(0, 4).map((d) => d.y)).toEqual([100, 0, 100, 100]);
  });

  it('aggregates long ranges of daily logs into weeks', () => {
    const { data, log } = setup({}, { '2026-06-01': 2, '2026-06-02': 4 });
    const s = buildSeries(data, log, { from: '2026-01-01', to: '2026-11-25' }, TODAY);
    expect(s.aggregated).toBe(true);
    expect(s.bucket).toBe('week');
    expect(s.points.find((p) => p.key === '2026-06-01')?.value).toBe(3);
  });

  it('counts choice options', () => {
    const { data, log } = setup(
      { type: 'choice', multi: true, options: [{ id: 'a', label: 'Fruit' }, { id: 'b', label: 'Coffee' }] },
      { '2026-11-01': ['a', 'b'], '2026-11-02': ['b'] },
    );
    const s = buildSeries(data, log, range, TODAY);
    expect(s.freq?.map((f) => [f.label, f.count])).toEqual([
      ['Fruit', 1],
      ['Coffee', 2],
    ]);
    expect(s.hero).toBe('Coffee');
  });

  it('builds round axes', () => {
    expect(niceAxis(0, 9, true)).toEqual({ min: 0, max: 10, step: 5 });
    expect(niceAxis(55, 85, true)).toEqual({ min: 40, max: 100, step: 20 });
  });
});
