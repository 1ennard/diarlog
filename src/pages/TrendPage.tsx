import { useMemo, useRef, useState } from 'react';
import { Chart, FreqBars } from '../components/Chart';
import { Icon, typeIcon } from '../components/Icon';
import { Segmented } from '../components/LogEditor';
import { Sheet } from '../components/Overlays';
import { addDays, type DateKey } from '../lib/dates';
import { isPlottable, periodLabel, typeLabel, type ChartKind, type LogDef, type RangeKind } from '../lib/model';
import { sortedLogs, updateTrend, useData } from '../lib/store';
import { buildSeries, chartModel, computeRange, rangeLabel, seriesTitle, shiftRange, tableRows, type DateRange, type Series } from '../lib/trend';

export function TrendPage({ today, wide }: { today: DateKey; wide: boolean }) {
  const data = useData();
  const t = data.settings.trend;
  const [anchor, setAnchor] = useState(today);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const plottable = sortedLogs(data).filter(isPlottable);
  const selected = plottable.filter((l) => t.selected.includes(l.id));
  const range = computeRange(t.range, anchor, today, t.custom);
  const atEnd = range.to >= today;

  const series = useMemo(
    () => selected.map((l) => buildSeries(data, l, range, today)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, selected.map((l) => l.id).join(), range.from, range.to, today],
  );

  const toggle = (id: string) =>
    updateTrend({ selected: t.selected.includes(id) ? t.selected.filter((x) => x !== id) : [...t.selected, id] });

  const q = query.trim().toLowerCase();
  const filtered = q ? plottable.filter((l) => l.name.toLowerCase().includes(q)) : plottable;

  const shift = (dir: -1 | 1) => {
    const r = shiftRange(t.range, anchor, dir, t.custom);
    setAnchor(r.anchor);
    if (r.custom) updateTrend({ custom: r.custom });
  };

  const rangeControls = (
    <>
      <div className="range-row">
        <Segmented<RangeKind>
          label="Time range"
          value={t.range}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
          onChange={(range) => {
            setAnchor(today);
            updateTrend({ range });
          }}
          className={`no-check${t.range === 'custom' ? ' none-selected' : ''}`}
        />
        <button
          className={`icon-btn outlined${t.range === 'custom' ? ' on' : ''}`}
          aria-label="Custom date range"
          title="Custom date range"
          onClick={() => setCustomOpen(true)}
        >
          <Icon name="calendarRange" />
        </button>
      </div>
      <div className="range-nav">
        <button className="icon-btn small" aria-label="Previous range" onClick={() => shift(-1)}>
          <Icon name="back" size={20} />
        </button>
        <button className="range-label" onClick={() => setCustomOpen(true)}>
          {rangeLabel(range)}
        </button>
        <button className="icon-btn small" aria-label="Next range" disabled={atEnd} onClick={() => shift(1)}>
          <Icon name="forward" size={20} />
        </button>
      </div>
    </>
  );

  const plotControls = (
    <>
      <div className="plot-as">
        <span className="control-label">Plot as</span>
        <Segmented<ChartKind>
          label="Plot as"
          value={t.chart}
          options={[
            { value: 'line', label: 'Line', icon: <Icon name="trend" size={18} /> },
            { value: 'bar', label: 'Bar', icon: <Icon name="bar" size={18} /> },
            { value: 'table', label: 'Table', icon: <Icon name="table" size={18} /> },
          ]}
          onChange={(chart) => updateTrend({ chart })}
        />
      </div>
      <label className={`switch-row${t.chart === 'table' ? ' disabled' : ''}`}>
        <span>
          Skip days without logs
          <small>{t.skipEmpty ? 'Empty days are removed from the x-axis' : 'Lines connect across empty days'}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={t.skipEmpty}
          disabled={t.chart === 'table'}
          onChange={(e) => updateTrend({ skipEmpty: e.target.checked })}
        />
      </label>
    </>
  );

  const customSheet = (
    <CustomRangeSheet
      open={customOpen}
      initial={t.range === 'custom' && t.custom ? t.custom : range}
      today={today}
      onClose={() => setCustomOpen(false)}
      onApply={(custom) => {
        updateTrend({ range: 'custom', custom });
        setCustomOpen(false);
      }}
    />
  );

  const charts = (
    <div className={`chart-list${wide ? ' grid' : ''}`}>
      {!plottable.length && <p className="chart-empty big">Create a few logs first — then you can see their trends here.</p>}
      {!!plottable.length && !series.length && <p className="chart-empty big">Pick one or more logs to plot.</p>}
      {series.map((s) => (
        <ChartCard key={s.log.id} s={s} chart={t.chart} skipEmpty={t.skipEmpty} rangeKind={t.range} />
      ))}
    </div>
  );

  if (wide) {
    return (
      <div className="page trend-page wide">
        <header className="page-header">
          <h1 className="page-title">Trend</h1>
        </header>
        <div className="trend-split">
          <aside className="trend-controls">
            <div className="control-head">
              <span className="control-label">Logs to plot</span>
            </div>
            <label className="search-field">
              <Icon name="search" size={20} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search logs" aria-label="Search logs" />
              {query && (
                <button className="icon-btn small" aria-label="Clear search" onClick={() => setQuery('')}>
                  <Icon name="close" size={18} />
                </button>
              )}
            </label>
            <ul className="plot-list">
              {filtered.map((l) => (
                <li key={l.id}>
                  <label className="plot-item">
                    <input type="checkbox" checked={t.selected.includes(l.id)} onChange={() => toggle(l.id)} />
                    <span className="check-box" aria-hidden="true">
                      {t.selected.includes(l.id) && <Icon name="check" size={16} />}
                    </span>
                    <span className="plot-item-text">
                      {l.name}
                      <small>{plotSubtitle(l)}</small>
                    </span>
                  </label>
                </li>
              ))}
              {!filtered.length && <li className="plot-none">No log matches “{query}”.</li>}
            </ul>
            <hr className="divider" />
            <span className="control-label">Time range</span>
            {rangeControls}
            <hr className="divider" />
            {plotControls}
          </aside>
          {charts}
        </div>
        {customSheet}
      </div>
    );
  }

  return (
    <div className="page trend-page">
      <header className="page-header">
        <h1 className="page-title">Trend</h1>
      </header>
      <div className="chip-scroller">
        {searching ? (
          <label className="search-field inline">
            <Icon name="search" size={20} />
            <input
              ref={searchRef}
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search logs"
              aria-label="Search logs"
            />
            <button
              className="icon-btn small"
              aria-label="Close search"
              onClick={() => {
                setQuery('');
                setSearching(false);
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </label>
        ) : (
          <button className="icon-btn outlined chip-search" aria-label="Search logs" onClick={() => setSearching(true)}>
            <Icon name="search" size={20} />
          </button>
        )}
        <div className="chips nowrap" role="group" aria-label="Logs to plot">
          {filtered.map((l) => {
            const on = t.selected.includes(l.id);
            return (
              <button key={l.id} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(l.id)}>
                {on && <Icon name="check" size={18} />}
                {l.name}
              </button>
            );
          })}
          {!filtered.length && <span className="plot-none">No log matches “{query}”.</span>}
        </div>
      </div>
      {rangeControls}
      {plotControls}
      {charts}
      {customSheet}
    </div>
  );
}

function plotSubtitle(l: LogDef): string {
  const type = l.type === 'checkbox' ? 'Checkbox · rate' : typeLabel(l);
  return l.period === 'daily' ? type : `${type} · ${periodLabel(l.period).toLowerCase()}`;
}

function ChartCard({ s, chart, skipEmpty, rangeKind }: { s: Series; chart: ChartKind; skipEmpty: boolean; rangeKind: RangeKind }) {
  const title = chart === 'line' ? seriesTitle(s) : s.aggregated && s.kind !== 'multi' ? `${s.log.name} · weekly ${s.kind === 'rate' ? 'rate' : 'avg'}` : s.log.name;
  const definedCount = s.points.filter((p) => p.value !== undefined).length;
  let body: React.ReactNode;
  if (s.kind === 'multi') {
    body = <FreqBars rows={s.freq ?? []} total={definedCount} />;
  } else if (chart === 'table') {
    const rows = tableRows(s);
    body = rows.length ? (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{s.bucket === 'day' ? 'Day' : s.bucket === 'week' ? 'Week' : 'Month'}</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="chart-empty">Nothing logged in this range.</p>
    );
  } else if (definedCount === 0) {
    body = <p className="chart-empty">Nothing logged in this range.</p>;
  } else {
    const model = chartModel(s, chart, skipEmpty, rangeKind);
    body = <Chart model={model} mode={chart} label={`${title}: ${s.stats}. Use arrow keys to read values.`} />;
  }
  return (
    <section className="card chart-card" aria-label={title}>
      <header className="chart-head">
        <div className="chart-titles">
          <h3 className="card-title">
            <Icon name={typeIcon(s.log.type)} size={18} className="title-icon" />
            {title}
          </h3>
          <p className="chart-stats">{s.stats}</p>
        </div>
        <span className="chart-hero" title={s.kind === 'rate' ? 'Done-rate in this range' : s.kind === 'ordinal' || s.kind === 'multi' ? 'Most often' : 'Latest value'}>
          {s.hero}
        </span>
      </header>
      {body}
    </section>
  );
}

function CustomRangeSheet({ open, initial, today, onClose, onApply }: { open: boolean; initial: DateRange; today: DateKey; onClose: () => void; onApply: (r: DateRange) => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Custom date range" className="dialog-small">
      {open && <CustomRangeForm initial={initial} today={today} onClose={onClose} onApply={onApply} />}
    </Sheet>
  );
}

function CustomRangeForm({ initial, today, onClose, onApply }: { initial: DateRange; today: DateKey; onClose: () => void; onApply: (r: DateRange) => void }) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const presets: { label: string; days: number }[] = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'Last 365 days', days: 365 },
  ];
  const valid = from && to && from <= to;
  return (
    <div className="dialog-body">
      <h2 className="dialog-title">Date range</h2>
      <div className="preset-list">
        {presets.map((p) => (
          <button key={p.days} className="preset" onClick={() => onApply({ from: addDays(today, -(p.days - 1)), to: today })}>
            {p.label}
          </button>
        ))}
      </div>
      <hr className="divider" />
      <div className="date-fields">
        <label className="outlined-field small">
          <span className="field-label">From</span>
          <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="outlined-field small">
          <span className="field-label">To</span>
          <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="dialog-actions">
        <button className="btn text" onClick={onClose}>
          Cancel
        </button>
        <button className="btn filled" disabled={!valid} onClick={() => valid && onApply({ from, to })}>
          Apply
        </button>
      </div>
    </div>
  );
}
