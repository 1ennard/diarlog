import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { periodStart } from '../lib/dates';
import type { LogDef, Value } from '../lib/model';
import { clearValue, moveLog, setValue, useData } from '../lib/store';
import { useLongPress } from '../lib/hooks';
import { useUi } from '../lib/ui';
import {
  defaultMeta,
  editedLabel,
  fmtNumber,
  fullTimestamp,
  previousMeta,
  resolve,
  type Resolved,
} from '../lib/values';
import { Icon } from './Icon';

export interface LogCardProps {
  log: LogDef;
  periodKey: string;
  today: string;
  /** span the full row of a two-column grid */
  wide: boolean;
  active?: boolean;
  first?: boolean;
  last?: boolean;
}

/** Wide by nature: these need horizontal room on narrow grids. */
export function isWideType(log: LogDef): boolean {
  return log.type === 'percent' || log.type === 'text' || log.type === 'choice';
}

export function LogCard({ log, periodKey, today, wide, active, first, last }: LogCardProps) {
  const data = useData();
  const ui = useUi();
  const r = resolve(data, log, periodKey, today);
  const set = (v: Value) => setValue(log.id, periodKey, v);
  const reordering = ui.reorderingPeriod === log.period;
  const press = useLongPress((el) => ui.openLogMenu(log, periodKey, el));

  const confirmDefault = () => {
    if (r.value !== undefined) set(r.value);
  };

  const meta = <Meta r={r} log={log} periodKey={periodKey} onConfirm={confirmDefault} />;

  let body: React.ReactNode;
  let headerRight: React.ReactNode = meta;
  let footer: React.ReactNode = null;

  switch (log.type) {
    case 'checkbox':
      body = <CheckboxBody r={r} past={periodKey < periodStart(log.period, today)} onToggle={() => set(!(r.value === true))} />;
      break;
    case 'number':
      body = <NumberBody log={log} r={r} onSet={set} />;
      break;
    case 'percent':
      headerRight = <span className="card-value">{r.value === undefined ? '—' : `${Math.round(Number(r.value))} %`}</span>;
      body = <PercentBody r={r} onSet={set} label={log.name} />;
      footer = <div className="card-footer">{meta}</div>;
      break;
    case 'text':
      body = <TextBody key={`${log.id}|${periodKey}`} r={r} onSave={set} onClear={() => clearValue(log.id, periodKey)} label={log.name} />;
      break;
    case 'choice':
      body = <ChoiceBody log={log} r={r} onSet={set} onClear={() => clearValue(log.id, periodKey)} />;
      break;
  }

  const classes = ['card', `card-${log.type}`, wide ? 'wide' : '', active ? 'active' : '', reordering ? 'reordering' : '', r.source === 'none' ? 'is-empty' : '', r.source === 'fixed' || r.source === 'previous' ? 'is-default' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} aria-label={log.name} {...(reordering ? {} : press)}>
      <header className="card-header">
        <h3 className="card-title">{log.name}</h3>
        {reordering ? (
          <span className="reorder-buttons">
            <button className="icon-btn small" disabled={first} onClick={() => moveLog(log.id, -1)} aria-label={`Move ${log.name} up`}>
              <Icon name="up" size={20} />
            </button>
            <button className="icon-btn small" disabled={last} onClick={() => moveLog(log.id, 1)} aria-label={`Move ${log.name} down`}>
              <Icon name="down" size={20} />
            </button>
          </span>
        ) : (
          <span className="card-header-right">
            {headerRight}
            <button
              className="icon-btn small card-more"
              aria-label={`More options for ${log.name}`}
              data-no-longpress
              onClick={(e) => ui.openLogMenu(log, periodKey, e.currentTarget.closest('.card') as HTMLElement)}
            >
              <Icon name="more" size={20} />
            </button>
          </span>
        )}
      </header>
      <div className="card-body" aria-hidden={reordering || undefined}>
        {body}
      </div>
      {footer}
    </section>
  );
}

// ---------- meta: edit time, or that a default is shown ----------

function Meta({ r, log, periodKey, onConfirm }: { r: Resolved; log: LogDef; periodKey: string; onConfirm: () => void }) {
  if (r.source === 'entry' && r.entry) {
    return (
      <span className="meta" title={`Logged ${fullTimestamp(r.entry.t)}`}>
        {editedLabel(r.entry.t, new Date(), log.period === 'daily' ? periodKey : undefined)}
      </span>
    );
  }
  if (r.source === 'fixed' || r.source === 'previous') {
    const text = r.source === 'fixed' ? defaultMeta(log) : previousMeta(r, log, periodKey);
    return (
      <button
        className="meta meta-default"
        data-no-longpress
        title="Nothing logged yet — this is the default value. Tap to keep it."
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
      >
        {r.source === 'previous' && <Icon name="prefilled" size={14} />}
        {text}
      </button>
    );
  }
  return null;
}

// ---------- checkbox ----------

function CheckboxBody({ r, past, onToggle }: { r: Resolved; past: boolean; onToggle: () => void }) {
  const on = r.value === true;
  const label = on ? 'Done' : r.source === 'entry' || (past && r.source !== 'none') ? 'Not done' : past ? 'Not logged' : 'Not yet';
  return (
    <button className={`check-row${on ? ' on' : ''}`} role="checkbox" aria-checked={on} onClick={onToggle}>
      <span className="check-box" aria-hidden="true">
        {on && <Icon name="check" size={18} />}
      </span>
      <span className="check-label">{label}</span>
    </button>
  );
}

// ---------- number ----------

function NumberBody({ log, r, onSet }: { log: LogDef; r: Resolved; onSet: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const value = r.value === undefined ? undefined : Number(r.value);
  const step = log.step && log.step > 0 ? log.step : 1;
  const base = value ?? log.start ?? 0;
  const floor = (log.start ?? 0) >= 0 ? 0 : -Infinity;
  const stepper = (log.input ?? 'stepper') === 'stepper';

  return (
    <>
      <div className="num-row">
        {editing ? (
          <NumberInput
            initial={value}
            unit={log.unit}
            onDone={(n) => {
              setEditing(false);
              if (n !== undefined) onSet(n);
            }}
          />
        ) : (
          <button className="num-value" onClick={() => setEditing(true)} aria-label={`${log.name}: ${value ?? 'empty'}. Tap to type a value`}>
            <span className="num">{value === undefined ? '—' : fmtNumber(value)}</span>
            {log.unit && <span className="unit">{log.unit}</span>}
          </button>
        )}
      </div>
      {!editing &&
        (stepper ? (
          <div className="stepper">
            <button className="round-btn" aria-label={`Decrease ${log.name}`} disabled={base - step < floor} onClick={() => onSet(Math.max(floor, base - step))}>
              <Icon name="remove" />
            </button>
            <button className="round-btn" aria-label={`Increase ${log.name}`} onClick={() => onSet(base + step)}>
              <Icon name="add" />
            </button>
          </div>
        ) : (
          <button className="tonal-field" onClick={() => setEditing(true)}>
            <Icon name="edit" size={18} />
            {value === undefined ? 'Enter value' : 'Edit value'}
          </button>
        ))}
    </>
  );
}

function NumberInput({ initial, unit, onDone }: { initial?: number; unit?: string; onDone: (n: number | undefined) => void }) {
  const [text, setText] = useState(initial === undefined ? '' : String(initial));
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const n = Number(text.replace(/[\s ,]/g, ''));
    onDone(save && text.trim() !== '' && Number.isFinite(n) ? Math.round(n) : undefined);
  };
  return (
    <form
      className="num-edit"
      onSubmit={(e) => {
        e.preventDefault();
        commit(true);
      }}
    >
      <input
        ref={ref}
        className="num-input"
        inputMode="numeric"
        enterKeyHint="done"
        pattern="-?[0-9 ]*"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') commit(false);
        }}
        aria-label="Value"
      />
      {unit && <span className="unit">{unit}</span>}
      <button type="submit" className="icon-btn filled small" aria-label="Save value" onPointerDown={(e) => e.preventDefault()}>
        <Icon name="check" size={20} />
      </button>
    </form>
  );
}

// ---------- percent ----------

function PercentBody({ r, onSet, label }: { r: Resolved; onSet: (v: number) => void; label: string }) {
  const value = r.value === undefined ? undefined : Number(r.value);
  const shown = value ?? 50;
  return (
    <div className={`slider-wrap${value === undefined ? ' unset' : ''}`} data-no-longpress>
      <input
        type="range"
        className="slider"
        min={0}
        max={100}
        step={1}
        value={shown}
        style={{ '--pct': `${shown}%` } as React.CSSProperties}
        aria-label={label}
        aria-valuetext={value === undefined ? 'not logged' : `${value} %`}
        onChange={(e) => onSet(Number(e.target.value))}
        onClick={(e) => {
          // a tap on an unset slider at its current position still logs a value
          if (value === undefined) onSet(Number((e.target as HTMLInputElement).value));
        }}
      />
    </div>
  );
}

// ---------- text ----------

function TextBody({ r, onSave, onClear, label }: { r: Resolved; onSave: (v: string) => void; onClear: () => void; label: string }) {
  const stored = r.value === undefined ? '' : String(r.value);
  const [draft, setDraft] = useState(stored);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ draft, stored, onSave, onClear });
  latest.current = { draft, stored, onSave, onClear };

  // follow outside changes while not editing
  useEffect(() => {
    if (!focused) setDraft(stored);
  }, [stored, focused]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, focused]);

  const save = () => {
    clearTimeout(timer.current);
    const { draft: d, stored: s, onSave: save, onClear: clear } = latest.current;
    if (d === s) return;
    if (d.trim() === '') clear();
    else save(d);
  };

  // save on unmount (e.g. sheet closed while typing)
  useEffect(() => () => save(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <textarea
        ref={ref}
        className="text-input"
        rows={2}
        value={draft}
        placeholder="Tap to start writing"
        aria-label={label}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          save();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(save, 600);
        }}
      />
      {!focused && draft && <div className="card-hint">Tap to keep writing</div>}
    </>
  );
}

// ---------- choice ----------

function ChoiceBody({ log, r, onSet, onClear }: { log: LogDef; r: Resolved; onSet: (v: string | string[]) => void; onClear: () => void }) {
  const options = log.options ?? [];
  if (log.multi) {
    const sel = new Set(Array.isArray(r.value) ? r.value : []);
    return (
      <div className="chips" role="group" aria-label={log.name}>
        {options.map((o) => {
          const on = sel.has(o.id);
          return (
            <button
              key={o.id}
              className={`chip${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => {
                const next = new Set(sel);
                if (on) next.delete(o.id);
                else next.add(o.id);
                onSet(options.filter((x) => next.has(x.id)).map((x) => x.id));
              }}
            >
              {on && <Icon name="check" size={18} />}
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }
  const selected = typeof r.value === 'string' ? r.value : undefined;
  const segmented = options.length <= 4 && options.every((o) => o.label.length <= 12);
  const pick = (id: string) => (id === selected && r.source === 'entry' ? onClear() : onSet(id));
  if (segmented) {
    return (
      <div className="segmented full" role="radiogroup" aria-label={log.name}>
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={o.id === selected} className={o.id === selected ? 'on' : ''} onClick={() => pick(o.id)}>
            {o.id === selected && <Icon name="check" size={18} />}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="chips" role="radiogroup" aria-label={log.name}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={o.id === selected} className={`chip${o.id === selected ? ' on' : ''}`} onClick={() => pick(o.id)}>
          {o.id === selected && <Icon name="check" size={18} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
