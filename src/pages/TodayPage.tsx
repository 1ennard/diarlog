import { DayView } from '../components/DayView';
import { Icon } from '../components/Icon';
import { addDays, fmtLongDate, relativeDayTitle, type DateKey } from '../lib/dates';

export function TodayPage({
  today,
  date,
  wide,
  split,
  onDate,
  onMore,
  activeLogId,
}: {
  today: DateKey;
  date: DateKey;
  wide: boolean;
  split: boolean;
  onDate: (d: DateKey) => void;
  onMore: (el: HTMLElement) => void;
  activeLogId: string | null;
}) {
  const isToday = date === today;
  return (
    <div className="page today-page">
      <header className="page-header">
        <div>
          <p className="page-date">{fmtLongDate(date)}</p>
          <h1 className="page-title">{relativeDayTitle(date, today)}</h1>
        </div>
        <div className="header-actions">
          {!isToday && (
            <button className="btn text" onClick={() => onDate(today)}>
              Today
            </button>
          )}
          {wide && (
            <>
              <button className="icon-btn" aria-label="Previous day" onClick={() => onDate(addDays(date, -1))}>
                <Icon name="back" />
              </button>
              <button className="icon-btn" aria-label="Next day" disabled={isToday} onClick={() => onDate(addDays(date, 1))}>
                <Icon name="forward" />
              </button>
            </>
          )}
          <button className="icon-btn" aria-label="More options" onClick={(e) => onMore(e.currentTarget)}>
            <Icon name="more" />
          </button>
        </div>
      </header>
      <DayView date={date} today={today} context="today" split={split} activeLogId={activeLogId} />
    </div>
  );
}
