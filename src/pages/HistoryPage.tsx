import { useEffect, useMemo, useState } from 'react';
import { DayView } from '../components/DayView';
import { Icon } from '../components/Icon';
import {
  addDays,
  addMonths,
  fmtLongDate,
  fmtMonthYear,
  fromKey,
  startOfMonth,
  startOfWeek,
  type DateKey,
} from '../lib/dates';
import { countedLogs, isMonthStart, isWeekStart, loggedCount, logsOf } from '../lib/day';
import type { Data } from '../lib/model';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import { formatValue, resolve } from '../lib/values';

const WEEKDAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HistoryPage({ today, wide, date, onSelect }: { today: DateKey; wide: boolean; date?: DateKey; onSelect: (d: DateKey | undefined) => void }) {
  const data = useData();
  const ui = useUi();
  const selected = date && date <= today ? date : undefined;
  const [month, setMonth] = useState(() => startOfMonth(selected ?? today));
  const shownMonth = month;
  // follow the selection when it changes from outside (search results, day stepping)
  useEffect(() => {
    if (selected) setMonth(startOfMonth(selected));
  }, [selected]);

  const goMonth = (dir: -1 | 1) => setMonth(addMonths(shownMonth, dir));

  const header = (
    <header className="page-header">
      <div>
        <h1 className="page-title">History</h1>
      </div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Search logs" onClick={() => ui.openSearch()}>
          <Icon name="search" />
        </button>
      </div>
    </header>
  );

  const calendar = (
    <Calendar
      data={data}
      month={shownMonth}
      today={today}
      selected={selected}
      wide={wide}
      onPrev={() => goMonth(-1)}
      onNext={() => goMonth(1)}
      onToday={() => {
        setMonth(startOfMonth(today));
        onSelect(today);
      }}
      onSelect={onSelect}
    />
  );

  if (wide) {
    return (
      <div className="page history-page wide">
        {header}
        <div className="history-split">
          <div className="history-cal">{calendar}</div>
          {selected ? (
            <aside className="day-panel" aria-label={`Logs for ${fmtLongDate(selected)}`}>
              <DayPanelHeader date={selected} today={today} onClose={() => onSelect(undefined)} onStep={onSelect} />
              <DayView date={selected} today={today} context="history" narrow />
            </aside>
          ) : (
            <aside className="day-panel placeholder">
              <p>Pick a day to see and edit what you logged.</p>
            </aside>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page history-page">
      {header}
      {calendar}
      {selected && <DaySummary date={selected} today={today} onOpen={() => ui.openDay(selected)} />}
    </div>
  );
}

export function DayPanelHeader({ date, today, onClose, onStep, closeLabel }: { date: DateKey; today: DateKey; onClose: () => void; onStep: (d: DateKey) => void; closeLabel?: string }) {
  const data = useData();
  const c = loggedCount(data, 'daily', date);
  const weekly = isWeekStart(date) ? logsOf(data, 'weekly').length : 0;
  const monthly = isMonthStart(date) ? logsOf(data, 'monthly').length : 0;
  const parts = [`${c.done} of ${c.total} daily`];
  if (weekly) parts.push(`${weekly} weekly`);
  if (monthly) parts.push(`${monthly} monthly`);
  return (
    <div className="day-panel-head">
      <button className="icon-btn" aria-label="Previous day" onClick={() => onStep(addDays(date, -1))}>
        <Icon name="back" />
      </button>
      <div className="day-panel-title">
        <h2>{fmtLongDate(date)}</h2>
        <p>{parts.join(' · ')}</p>
      </div>
      <button className="icon-btn" aria-label="Next day" disabled={date >= today} onClick={() => onStep(addDays(date, 1))}>
        <Icon name="forward" />
      </button>
      {closeLabel ? (
        <button className="btn text" onClick={onClose}>
          {closeLabel}
        </button>
      ) : (
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

// ---------- calendar ----------

function Calendar({
  data,
  month,
  today,
  selected,
  wide,
  onPrev,
  onNext,
  onToday,
  onSelect,
}: {
  data: Data;
  month: DateKey;
  today: DateKey;
  selected?: DateKey;
  wide: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (d: DateKey) => void;
}) {
  const hasWeekly = logsOf(data, 'weekly').length > 0;
  const hasMonthly = logsOf(data, 'monthly').length > 0;
  const days = useMemo(() => {
    const first = startOfWeek(month);
    const out: DateKey[] = [];
    for (let i = 0; i < 42; i++) out.push(addDays(first, i));
    // drop a trailing week that lies completely in the next month
    if (out[35].slice(0, 7) !== month.slice(0, 7)) out.splice(35);
    return out;
  }, [month]);
  const monthPrefix = month.slice(0, 7);
  const isCurrentMonth = startOfMonth(today) === month;

  return (
    <div className={`calendar${wide ? ' wide' : ''}`}>
      <div className="cal-head">
        <h2 className="cal-month">{fmtMonthYear(month)}</h2>
        <div className="cal-nav">
          {!isCurrentMonth && (
            <button className="btn text" onClick={onToday}>
              Today
            </button>
          )}
          <button className="icon-btn" aria-label="Previous month" onClick={onPrev}>
            <Icon name="back" />
          </button>
          <button className="icon-btn" aria-label="Next month" onClick={onNext}>
            <Icon name="forward" />
          </button>
        </div>
      </div>
      <div className="cal-grid" role="grid" aria-label={fmtMonthYear(month)}>
        {(wide ? WEEKDAYS : WEEKDAYS_SHORT).map((d, i) => (
          <div key={i} className="cal-weekday" role="columnheader">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === monthPrefix;
          const future = d > today;
          const c = loggedCount(data, 'daily', d);
          const frac = c.total ? c.done / c.total : 0;
          const showW = hasWeekly && isWeekStart(d) && !future && inMonth;
          const showM = hasMonthly && isMonthStart(d) && !future && inMonth;
          const wDone = showW && periodDone(data, 'weekly', d);
          const mDone = showM && periodDone(data, 'monthly', d);
          const cls = ['cal-day', inMonth ? '' : 'outside', future ? 'future' : '', d === today ? 'today' : '', d === selected ? 'selected' : '']
            .filter(Boolean)
            .join(' ');
          const label = `${fmtLongDate(d)}${c.total && !future ? `, ${c.done} of ${c.total} daily logs` : ''}${showW ? ', weekly logs' : ''}${showM ? ', monthly logs' : ''}`;
          return (
            <button
              key={d}
              className={cls}
              role="gridcell"
              aria-label={label}
              aria-selected={d === selected}
              disabled={future || !inMonth}
              onClick={() => onSelect(d)}
            >
              <span className="cal-ring-wrap">
                {!future && inMonth && d !== today && c.total > 0 && <Ring frac={frac} size={wide ? 34 : 40} />}
                {!wide && <span className="cal-num">{fromKey(d).getDate()}</span>}
              </span>
              {wide && (
                <>
                  <span className="cal-num">{fromKey(d).getDate()}</span>
                  {!future && inMonth && c.total > 0 && d !== today && (
                    <span className="cal-count">
                      {c.done}/{c.total}
                    </span>
                  )}
                </>
              )}
              {(showW || showM) && (
                <span className="cal-badges">
                  {showM && <span className={`badge m${mDone ? '' : ' faint'}`}>M</span>}
                  {showW && <span className={`badge w${wDone ? '' : ' faint'}`}>W</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="cal-legend">
        <span>
          <Ring frac={1} size={14} /> Daily logs filled
        </span>
        {hasWeekly && (
          <span>
            <span className="badge w">W</span> Weekly logs
          </span>
        )}
        {hasMonthly && (
          <span>
            <span className="badge m">M</span> Monthly logs
          </span>
        )}
      </div>
    </div>
  );
}

function periodDone(data: Data, period: 'weekly' | 'monthly', key: DateKey): boolean {
  const logs = countedLogs(data, period, key);
  return logs.length > 0 && logs.some((l) => !!data.entries[l.id]?.[key]);
}

export function Ring({ frac, size }: { frac: number; size: number }) {
  const stroke = size >= 30 ? 3.5 : 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
      {frac > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * Math.min(1, frac)} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

// ---------- mobile: summary of the selected day ----------

function DaySummary({ date, today, onOpen }: { date: DateKey; today: DateKey; onOpen: () => void }) {
  const data = useData();
  const c = loggedCount(data, 'daily', date);
  const logs = logsOf(data, 'daily');
  const rows = logs
    .map((l) => ({ log: l, r: resolve(data, l, date, today) }))
    .filter((x) => x.r.value !== undefined);
  return (
    <section className="day-summary card">
      <button className="day-summary-head" onClick={onOpen}>
        <span>
          <span className="day-summary-title">{fmtLongDate(date)}</span>
          <span className="day-summary-sub">
            {c.done} of {c.total} daily logs
          </span>
        </span>
        <span className="open-link">
          {date === today ? 'Edit' : 'Open'} <Icon name="forward" size={20} />
        </span>
      </button>
      {rows.length ? (
        <ul className="summary-list">
          {rows.map(({ log, r }) => (
            <li key={log.id} className={r.source !== 'entry' ? 'is-default' : ''}>
              <span className="summary-name">{log.name}</span>
              <span className="summary-value">{formatValue(log, r.value, { short: true })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="summary-empty">Nothing logged on this day.</p>
      )}
    </section>
  );
}
