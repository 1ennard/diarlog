import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DayView } from './components/DayView';
import { Icon, typeIcon } from './components/Icon';
import { LogEditor } from './components/LogEditor';
import { Confirm, Menu, Sheet, Snackbar, type MenuItem, type Snack } from './components/Overlays';
import { SearchSheet } from './components/SearchSheet';
import { isDateKey, type DateKey } from './lib/dates';
import { loggedCount } from './lib/day';
import { demoData } from './lib/demo';
import { exportCsv, exportJson, readBackup } from './lib/io';
import { isPlottable, periodLabel, type LogDef, type Theme } from './lib/model';
import { navigate, runAfterOverlayClose, useIsWide, useMediaQuery, useRoute, useToday } from './lib/hooks';
import {
  clearAll,
  clearValue,
  deleteLog,
  duplicateLog,
  getLog,
  getState,
  replaceData,
  restoreLog,
  sortedLogs,
  updateSettings,
  updateTrend,
  useData,
} from './lib/store';
import { UiContext, type UiActions } from './lib/ui';
import { DayPanelHeader, HistoryPage } from './pages/HistoryPage';
import { TodayPage } from './pages/TodayPage';
import { TrendPage } from './pages/TrendPage';

type MenuState = { kind: 'log'; log: LogDef; periodKey: string; rect: DOMRect } | { kind: 'app'; rect: DOMRect } | null;
type ConfirmState = { title: string; text: string; confirmLabel: string; danger?: boolean; onConfirm: () => void } | null;

export default function App() {
  const data = useData();
  const today = useToday();
  const route = useRoute();
  const wide = useIsWide();
  const split = useMediaQuery('(min-width: 1180px)');

  const [menu, setMenu] = useState<MenuState>(null);
  const [editor, setEditor] = useState<{ logId: string | null; focus?: 'default' } | null>(null);
  const [daySheet, setDaySheet] = useState<DateKey | null>(null);
  const [search, setSearch] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [snack, setSnack] = useState<Snack | null>(null);
  const [reorderingPeriod, setReordering] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // theme
  const theme = data.settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const bg = getComputedStyle(root).getPropertyValue('--surface').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#fef7ff');
  }, [theme]);

  const routeDate = route.date && isDateKey(route.date) && route.date <= today ? route.date : undefined;
  const todayDate = route.page === 'today' && routeDate ? routeDate : today;

  const showSnack = useCallback((message: string, action?: Snack['action']) => setSnack({ id: Date.now(), message, action }), []);
  const closeSnack = useCallback(() => setSnack(null), []);

  const requestDelete = useCallback(
    (id: string) => {
      const log = getLog(getState(), id);
      if (!log) return;
      const n = Object.keys(getState().entries[id] ?? {}).length;
      setConfirm({
        title: `Delete “${log.name}”?`,
        text: n ? `This also deletes ${n} logged ${n === 1 ? 'value' : 'values'}.` : 'Nothing has been logged yet.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: () => {
          const removed = deleteLog(id);
          setEditor(null);
          if (removed) showSnack(`Deleted “${log.name}”`, { label: 'Undo', run: () => restoreLog(removed) });
        },
      });
    },
    [showSnack],
  );

  const ui: UiActions = useMemo(
    () => ({
      openLogMenu: (log, periodKey, anchor) => setMenu({ kind: 'log', log, periodKey, rect: anchor.getBoundingClientRect() }),
      openEditor: (logId, focus) => setEditor({ logId, focus }),
      openDay: (date) => setDaySheet(date),
      openSearch: () => setSearch(true),
      showSnack,
      reorderingPeriod,
      setReordering,
    }),
    [showSnack, reorderingPeriod],
  );

  // leave reorder mode when navigating away
  useEffect(() => setReordering(null), [route.page]);

  const loadDemo = () => {
    const run = () => {
      replaceData({ ...demoData(today), settings: { ...demoData(today).settings, theme: getState().settings.theme } });
      showSnack('Example logs loaded');
    };
    if (getState().logs.length) {
      setConfirm({
        title: 'Load example data?',
        text: 'This replaces all your logs and values with example data. Export a backup first if you want to keep them.',
        confirmLabel: 'Replace',
        danger: true,
        onConfirm: run,
      });
    } else run();
  };

  const onImportFile = async (file: File) => {
    try {
      const next = await readBackup(file);
      setConfirm({
        title: 'Import backup?',
        text: `Replace your current data with ${next.logs.length} logs from “${file.name}”?`,
        confirmLabel: 'Import',
        onConfirm: () => {
          replaceData({ ...next, settings: { ...next.settings, theme: getState().settings.theme } });
          showSnack('Backup imported');
        },
      });
    } catch (err) {
      showSnack(`Could not import: ${(err as Error).message}`);
    }
  };

  const logMenuItems = (m: Extract<MenuState, { kind: 'log' }>): MenuItem[] => {
    const { log, periodKey } = m;
    const inTrend = data.settings.trend.selected.includes(log.id);
    const hasValue = !!data.entries[log.id]?.[periodKey];
    const items: MenuItem[] = [
      { label: 'Edit log', icon: 'edit', onSelect: () => setEditor({ logId: log.id }) },
      { label: 'Change default value', icon: 'undo', onSelect: () => setEditor({ logId: log.id, focus: 'default' }) },
      {
        label: 'Duplicate',
        icon: 'copy',
        onSelect: () => {
          const c = duplicateLog(log.id);
          if (c) showSnack(`Created “${c.name}”`);
        },
      },
      { label: 'Reorder', icon: 'reorder', onSelect: () => setReordering(log.period) },
    ];
    if (isPlottable(log)) {
      items.push({
        label: inTrend ? 'Open in Trend' : 'Show in Trend',
        icon: 'trend',
        onSelect: () => {
          if (!inTrend) updateTrend({ selected: [...data.settings.trend.selected, log.id] });
          setDaySheet(null);
          runAfterOverlayClose(() => navigate('trend'));
        },
      });
    }
    if (hasValue) items.push({ label: 'Clear value', icon: 'eraser', onSelect: () => clearValue(log.id, periodKey) });
    items.push({ label: 'Delete', icon: 'delete', danger: true, divider: true, onSelect: () => requestDelete(log.id) });
    return items;
  };

  const themeNext: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
  const appMenuItems: MenuItem[] = [
    { label: 'New log', icon: 'add', onSelect: () => setEditor({ logId: null }) },
    { label: 'Search', icon: 'search', onSelect: () => setSearch(true) },
    { label: `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`, icon: 'theme', onSelect: () => updateSettings({ theme: themeNext[theme] }) },
    { label: 'Export backup (JSON)', icon: 'download', divider: true, onSelect: () => exportJson(getState()) },
    { label: 'Export values (CSV)', icon: 'csv', onSelect: () => exportCsv(getState()) },
    { label: 'Import backup', icon: 'upload', onSelect: () => fileRef.current?.click() },
    { label: 'Load example data', icon: 'demo', divider: true, onSelect: loadDemo },
    {
      label: 'Delete all data',
      icon: 'deleteAll',
      danger: true,
      onSelect: () =>
        setConfirm({
          title: 'Delete all data?',
          text: 'All logs and logged values on this device are removed. This cannot be undone.',
          confirmLabel: 'Delete all',
          danger: true,
          onConfirm: () => {
            clearAll();
            showSnack('All data deleted');
          },
        }),
    },
  ];

  const openMore = (el: HTMLElement) => setMenu({ kind: 'app', rect: el.getBoundingClientRect() });

  const todayCount = loggedCount(data, 'daily', today);
  let page: React.ReactNode;
  if (route.page === 'history') {
    page = (
      <HistoryPage
        today={today}
        wide={wide}
        date={routeDate}
        onSelect={(d) => {
          const next = `#/history${d ? '/' + d : ''}`;
          if (location.hash !== next) history.replaceState(history.state, '', next);
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }}
      />
    );
  } else if (route.page === 'trend') {
    page = <TrendPage today={today} wide={wide} />;
  } else {
    page = (
      <TodayPage
        today={today}
        date={todayDate}
        wide={wide}
        split={split}
        onDate={(d) => {
          const next = d === today ? '#/today' : `#/today/${d}`;
          history.replaceState(history.state, '', next);
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }}
        onMore={openMore}
        activeLogId={menu?.kind === 'log' ? menu.log.id : null}
      />
    );
  }

  const nav = [
    { page: 'today' as const, label: 'Today', icon: 'today' as const, badge: todayCount.total ? `${todayCount.done}/${todayCount.total}` : '' },
    { page: 'history' as const, label: 'History', icon: 'history' as const, badge: '' },
    { page: 'trend' as const, label: 'Trend', icon: 'trend' as const, badge: '' },
  ];

  return (
    <UiContext.Provider value={ui}>
      <div className={`app${wide ? ' wide' : ''}`}>
        {wide && (
          <nav className="sidebar" aria-label="Main">
            <div className="brand">
              <span className="brand-mark">
                <Icon name="check" size={22} />
              </span>
              Diarlog
            </div>
            <button className="fab extended" onClick={() => setEditor({ logId: null })}>
              <Icon name="add" /> New log
            </button>
            <ul className="nav-list">
              {nav.map((n) => (
                <li key={n.page}>
                  <a href={`#/${n.page}`} className={`nav-item${route.page === n.page ? ' on' : ''}`} aria-current={route.page === n.page ? 'page' : undefined}>
                    <Icon name={n.icon} />
                    <span>{n.label}</span>
                    {n.badge && <span className="nav-badge">{n.badge}</span>}
                  </a>
                </li>
              ))}
            </ul>
            {data.logs.length > 0 && (
              <>
                <hr className="divider" />
                <p className="nav-section">Logs</p>
                <ul className="log-list">
                  {sortedLogs(data).map((l) => (
                    <li key={l.id}>
                      <button className="log-list-item" onClick={() => setEditor({ logId: l.id })} title={`Edit ${l.name}`}>
                        <Icon name={typeIcon(l.type)} size={20} />
                        <span className="log-list-name">{l.name}</span>
                        <span className="log-list-period">{periodLabel(l.period)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button className="btn text sidebar-more" onClick={(e) => openMore(e.currentTarget)}>
              <Icon name="more" size={20} /> More
            </button>
          </nav>
        )}

        <main className="main" id="main">
          {page}
          {!data.logs.length && route.page === 'today' && (
            <div className="welcome-extra">
              <button className="btn tonal" onClick={loadDemo}>
                <Icon name="demo" size={20} /> Try with example data
              </button>
            </div>
          )}
        </main>

        {!wide && route.page === 'today' && data.logs.length > 0 && (
          <button className="fab" aria-label="New log" onClick={() => setEditor({ logId: null })}>
            <Icon name="add" />
          </button>
        )}

        {!wide && (
          <nav className="bottom-nav" aria-label="Main">
            {nav.map((n) => (
              <a key={n.page} href={`#/${n.page}`} className={`bottom-item${route.page === n.page ? ' on' : ''}`} aria-current={route.page === n.page ? 'page' : undefined}>
                <span className="bottom-pill">
                  <Icon name={n.icon} />
                </span>
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
        )}
      </div>

      {menu?.kind === 'log' && <Menu anchor={menu.rect} items={logMenuItems(menu)} onClose={() => setMenu(null)} label={`${menu.log.name} options`} />}
      {menu?.kind === 'app' && <Menu anchor={menu.rect} items={appMenuItems} onClose={() => setMenu(null)} label="More options" />}

      <Sheet open={!!editor} onClose={() => setEditor(null)} label={editor?.logId ? 'Edit log' : 'New log'} className="editor-sheet">
        {editor && <LogEditor key={editor.logId ?? 'new'} logId={editor.logId} focus={editor.focus} onClose={() => setEditor(null)} onDelete={requestDelete} />}
      </Sheet>

      <Sheet open={!!daySheet} onClose={() => setDaySheet(null)} label="Day" className="day-sheet">
        {daySheet && (
          <>
            <DayPanelHeader date={daySheet} today={today} onClose={() => setDaySheet(null)} onStep={(d) => setDaySheet(d)} closeLabel="Done" />
            <div className="day-sheet-body">
              <DayView date={daySheet} today={today} context="history" activeLogId={menu?.kind === 'log' ? menu.log.id : null} />
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={search} onClose={() => setSearch(false)} label="Search" className="search-sheet-wrap">
        {search && (
          <SearchSheet
            onClose={() => setSearch(false)}
            onOpenDay={(date) => {
              // weekly / monthly values live on the first day of their period, which is what `date` is
              setSearch(false);
              runAfterOverlayClose(() => {
                navigate('history', date);
                if (!wide) setDaySheet(date);
              });
            }}
          />
        )}
      </Sheet>

      <Confirm
        open={!!confirm}
        title={confirm?.title ?? ''}
        text={confirm?.text ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'OK'}
        danger={confirm?.danger}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />

      <Snackbar snack={snack} onDone={closeSnack} />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onImportFile(f);
        }}
      />
    </UiContext.Provider>
  );
}
