import { fmtMonth, fmtRange, isoWeek, endOfWeek, startOfMonth, startOfWeek, type DateKey } from '../lib/dates';
import { isMonthStart, isWeekStart, loggedCount, logsOf } from '../lib/day';
import type { LogDef, Period } from '../lib/model';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import { Icon } from './Icon';
import { LogCard, isWideType } from './LogCard';

interface Props {
  date: DateKey;
  today: DateKey;
  /** 'today': always show this week / this month. 'history': only on the first day of the week / month. */
  context: 'today' | 'history';
  /** two columns: daily on the left, weekly + monthly on the right (wide Today page) */
  split?: boolean;
  /** inside the narrow desktop History panel: every card full width */
  narrow?: boolean;
  activeLogId?: string | null;
}

export function DayView({ date, today, context, split, narrow, activeLogId }: Props) {
  const data = useData();
  const ui = useUi();

  const daily = logsOf(data, 'daily');
  const weekly = logsOf(data, 'weekly');
  const monthly = logsOf(data, 'monthly');
  const weekKey = startOfWeek(date);
  const monthKey = startOfMonth(date);
  const isCurrent = (p: Period) => (p === 'weekly' ? weekKey === startOfWeek(today) : monthKey === startOfMonth(today));
  const showWeek = weekly.length > 0 && (context === 'today' || isWeekStart(date));
  const showMonth = monthly.length > 0 && (context === 'today' || isMonthStart(date));

  if (!data.logs.length) {
    return (
      <div className="empty-state">
        <p className="empty-title">Nothing to log yet</p>
        <p className="empty-text">Create a log for anything you want to track — a habit, a number, your mood or a diary.</p>
        <button className="btn filled" onClick={() => ui.openEditor(null)}>
          <Icon name="add" size={20} /> New log
        </button>
      </div>
    );
  }

  const dailyCount = loggedCount(data, 'daily', date);
  const dailyCaption = dailyCount.total
    ? dailyCount.done === dailyCount.total
      ? 'All logged'
      : `${dailyCount.done} of ${dailyCount.total} logged`
    : '';

  const dailySection = daily.length > 0 && (
    <Section
      title="Daily"
      caption={dailyCaption}
      logs={daily}
      periodKey={date}
      today={today}
      // on the wide split layout the daily grid has room for every card in one column
      allNarrow={!!split}
      fullWidth={!!narrow}
      activeLogId={activeLogId}
    />
  );
  const weekSection = showWeek && (
    <Section
      title={context === 'today' && isCurrent('weekly') ? 'This week' : `Week ${isoWeek(weekKey)}`}
      caption={fmtRange(weekKey, endOfWeek(weekKey))}
      logs={weekly}
      periodKey={weekKey}
      today={today}
      fullWidth={!!narrow}
      activeLogId={activeLogId}
    />
  );
  const monthSection = showMonth && (
    <Section
      title={context === 'today' && isCurrent('monthly') ? 'This month' : fmtMonth(monthKey)}
      caption={context === 'today' && isCurrent('monthly') ? fmtMonth(monthKey) : monthKey.slice(0, 4)}
      logs={monthly}
      periodKey={monthKey}
      today={today}
      fullWidth={!!narrow}
      activeLogId={activeLogId}
    />
  );
  const addCard = context === 'today' && (
    <button className="add-card" onClick={() => ui.openEditor(null)}>
      <Icon name="add" size={20} /> New log
    </button>
  );

  if (split) {
    return (
      <div className="day-split">
        <div className="day-col daily-col">{dailySection}</div>
        <div className="day-col side">
          {weekSection}
          {monthSection}
          {addCard}
        </div>
      </div>
    );
  }
  return (
    <div className="day-stack">
      {dailySection}
      {weekSection}
      {monthSection}
      {addCard}
    </div>
  );
}

function Section(props: {
  title: string;
  caption: string;
  logs: LogDef[];
  periodKey: DateKey;
  today: DateKey;
  allNarrow?: boolean;
  fullWidth?: boolean;
  activeLogId?: string | null;
}) {
  const ui = useUi();
  const { logs } = props;
  const reordering = ui.reorderingPeriod === logs[0]?.period;
  return (
    <section className="log-section">
      <div className="section-head">
        <h2 className="section-title">{props.title}</h2>
        {reordering ? (
          <button className="btn text" onClick={() => ui.setReordering(null)}>
            Done
          </button>
        ) : (
          <span className="section-caption">{props.caption}</span>
        )}
      </div>
      <div className="card-grid">
        {logs.map((log, i) => (
          <LogCard
            key={log.id}
            log={log}
            periodKey={props.periodKey}
            today={props.today}
            wide={props.fullWidth || (!props.allNarrow && isWideType(log))}
            active={props.activeLogId === log.id}
            first={i === 0}
            last={i === logs.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
