import { useEffect, useMemo, useRef, useState } from 'react';
import { LOG_TYPES, PERIODS, uid, type ChoiceOption, type DefaultMode, type LogDef, type LogType, type NumberInput, type Period, type Value } from '../lib/model';
import { addLog, getLog, hasEntries, updateLog, useData } from '../lib/store';
import { Icon, typeIcon } from './Icon';

type Draft = Omit<LogDef, 'id' | 'order' | 'createdAt'>;

const blank = (): Draft => ({
  name: '',
  type: 'checkbox',
  period: 'daily',
  defaultMode: 'none',
});

function typeDefaults(type: LogType, d: Draft): Draft {
  const base: Draft = { name: d.name, type, period: d.period, defaultMode: d.defaultMode === 'fixed' ? 'none' : d.defaultMode };
  if (type === 'number') return { ...base, input: 'stepper', start: 0, step: 1, unit: '' };
  if (type === 'choice') return { ...base, multi: false, options: [{ id: uid(), label: '' }, { id: uid(), label: '' }] };
  return base;
}

export function LogEditor({ logId, focus, onClose, onDelete }: { logId: string | null; focus?: 'default'; onClose: () => void; onDelete: (id: string) => void }) {
  const data = useData();
  const existing = logId ? getLog(data, logId) : undefined;
  const locked = !!existing && hasEntries(data, existing.id);
  const [d, setD] = useState<Draft>(() => {
    if (!existing) return blank();
    const { id: _i, order: _o, createdAt: _c, ...rest } = structuredClone(existing);
    void _i, _o, _c;
    return rest;
  });
  const [tried, setTried] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const defaultRef = useRef<HTMLDivElement>(null);
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => {
    if (focus === 'default') defaultRef.current?.scrollIntoView({ block: 'center' });
    else if (!existing) nameRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = d.options ?? [];
  const cleanOptions = options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label);
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!d.name.trim()) e.push('name');
    if (d.type === 'choice' && cleanOptions.length < 1) e.push('options');
    return e;
  }, [d.name, d.type, cleanOptions.length]);

  const save = () => {
    setTried(true);
    if (errors.length) {
      if (errors.includes('name')) nameRef.current?.focus();
      return;
    }
    const out: Draft = { ...d, name: d.name.trim() };
    if (out.type === 'choice') out.options = cleanOptions;
    if (out.type === 'number') {
      out.step = Math.max(1, Math.round(out.step ?? 1));
      out.start = Math.round(out.start ?? 0);
      out.unit = (out.unit ?? '').trim() || undefined;
    }
    out.defaultValue = out.defaultMode === 'fixed' ? sanitizeDefault(out) : undefined;
    if (out.defaultMode === 'fixed' && out.defaultValue === undefined) out.defaultMode = 'none';
    if (existing) updateLog(existing.id, out);
    else addLog(out);
    onClose();
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        <h2 className="editor-title">{existing ? 'Edit log' : 'New log'}</h2>
        <button className="btn filled" onClick={save}>
          Save
        </button>
      </div>

      <div className="editor-scroll">
        <label className={`outlined-field${tried && errors.includes('name') ? ' error' : ''}`}>
          <span className="field-label">Name</span>
          <input
            ref={nameRef}
            value={d.name}
            maxLength={40}
            placeholder="e.g. Glasses of water"
            onChange={(e) => patch({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <span className="field-count">{d.name.length}/40</span>
        </label>
        {tried && errors.includes('name') && <p className="field-error">Give the log a name.</p>}

        <h3 className="editor-section">Type</h3>
        <div className="type-grid" role="radiogroup" aria-label="Type">
          {LOG_TYPES.map((t) => (
            <button
              key={t.type}
              role="radio"
              aria-checked={d.type === t.type}
              className={`type-tile${d.type === t.type ? ' on' : ''}`}
              disabled={locked && d.type !== t.type}
              onClick={() => d.type !== t.type && setD(typeDefaults(t.type, d))}
            >
              <Icon name={typeIcon(t.type)} />
              <span>{t.label}</span>
            </button>
          ))}
          <button className="type-tile" disabled aria-disabled="true">
            <Icon name="image" />
            <span>Image · soon</span>
          </button>
        </div>

        {d.type === 'number' && (
          <>
            <h3 className="editor-section">How to log</h3>
            <Segmented<NumberInput>
              value={d.input ?? 'stepper'}
              options={[
                { value: 'stepper', label: 'Stepper' },
                { value: 'keypad', label: 'Keypad' },
              ]}
              onChange={(input) => patch({ input })}
            />
            <div className="list-box">
              {(d.input ?? 'stepper') === 'stepper' && (
                <>
                  <NumberRow label="Start value" hint="where + and − start from" value={d.start ?? 0} onChange={(start) => patch({ start })} />
                  <NumberRow label="Step" value={d.step ?? 1} min={1} onChange={(step) => patch({ step })} />
                </>
              )}
              <label className="list-row">
                <span>Unit</span>
                <input className="row-input" value={d.unit ?? ''} placeholder="e.g. glasses" maxLength={16} onChange={(e) => patch({ unit: e.target.value })} />
              </label>
            </div>
          </>
        )}

        {d.type === 'percent' && <p className="editor-note">Logged with a slider from 0 to 100 %.</p>}
        {d.type === 'text' && <p className="editor-note">A free text field — for a diary, notes or reflections.</p>}

        {d.type === 'choice' && (
          <>
            <h3 className="editor-section">How to log</h3>
            <Segmented<'single' | 'multi'>
              value={d.multi ? 'multi' : 'single'}
              options={[
                { value: 'single', label: 'Single choice' },
                { value: 'multi', label: 'Multiple choice' },
              ]}
              onChange={(v) => patch({ multi: v === 'multi', defaultValue: undefined })}
            />
            <h3 className="editor-section">Options</h3>
            <OptionsEditor options={options} onChange={(o) => patch({ options: o })} />
            {tried && errors.includes('options') && <p className="field-error">Add at least one option.</p>}
            {!d.multi && <p className="editor-note">Order options from worst to best — Trend plots them in this order.</p>}
          </>
        )}

        <h3 className="editor-section">Time period</h3>
        <Segmented<Period>
          value={d.period}
          disabled={locked}
          options={PERIODS.map((p) => ({ value: p.period, label: p.label }))}
          onChange={(period) => patch({ period })}
        />
        {locked && <p className="editor-note">Type and time period are fixed once something is logged. Use “Duplicate” to start a variant.</p>}

        <div ref={defaultRef}>
          <h3 className="editor-section">Default value (when nothing is logged)</h3>
          <DefaultPicker draft={d} onChange={patch} />
        </div>

        <p className="editor-footnote">Long-press a log on Today to change these settings later.</p>

        {existing && (
          <button className="btn danger-text block" onClick={() => onDelete(existing.id)}>
            <Icon name="delete" size={20} /> Delete log
          </button>
        )}
      </div>
    </div>
  );
}

function sanitizeDefault(d: Draft): Value | undefined {
  const v = d.defaultValue;
  switch (d.type) {
    case 'checkbox':
      return typeof v === 'boolean' ? v : false;
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined;
    case 'percent':
      return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : undefined;
    case 'text':
      return typeof v === 'string' && v.trim() ? v : undefined;
    case 'choice': {
      const ids = new Set((d.options ?? []).filter((o) => o.label.trim()).map((o) => o.id));
      if (d.multi) return Array.isArray(v) ? v.filter((x) => ids.has(x)) : undefined;
      return typeof v === 'string' && ids.has(v) ? v : undefined;
    }
  }
}

// ---------- pieces ----------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className = '',
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`segmented ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          disabled={disabled && o.value !== value}
          onClick={() => onChange(o.value)}
        >
          {o.value === value ? <Icon name="check" size={18} /> : o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function NumberRow({ label, hint, value, min, onChange }: { label: string; hint?: string; value: number; min?: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="list-row">
      <span>
        {label}
        {hint && <small className="row-hint">{hint}</small>}
      </span>
      <input
        className="row-input num"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(min !== undefined ? Math.max(min, n) : n);
        }}
        onBlur={() => setText(String(value))}
      />
    </label>
  );
}

function OptionsEditor({ options, onChange }: { options: ChoiceOption[]; onChange: (o: ChoiceOption[]) => void }) {
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (focusId) refs.current.get(focusId)?.focus();
  }, [focusId]);
  const move = (i: number, dir: -1 | 1) => {
    const next = [...options];
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x);
    onChange(next);
  };
  const add = () => {
    const o = { id: uid(), label: '' };
    onChange([...options, o]);
    setFocusId(o.id);
  };
  return (
    <div className="options-editor">
      {options.map((o, i) => (
        <div className="option-row" key={o.id}>
          <input
            ref={(el) => {
              if (el) refs.current.set(o.id, el);
              else refs.current.delete(o.id);
            }}
            className="option-input"
            value={o.label}
            placeholder={`Option ${i + 1}`}
            maxLength={24}
            aria-label={`Option ${i + 1}`}
            onChange={(e) => onChange(options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (i === options.length - 1) add();
                else refs.current.get(options[i + 1].id)?.focus();
              }
            }}
          />
          <button className="icon-btn small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move option up">
            <Icon name="up" size={18} />
          </button>
          <button className="icon-btn small" disabled={i === options.length - 1} onClick={() => move(i, 1)} aria-label="Move option down">
            <Icon name="down" size={18} />
          </button>
          <button className="icon-btn small" onClick={() => onChange(options.filter((x) => x.id !== o.id))} aria-label="Remove option">
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
      <button className="btn text" onClick={add}>
        <Icon name="add" size={20} /> Add option
      </button>
    </div>
  );
}

function DefaultPicker({ draft: d, onChange }: { draft: Draft; onChange: (p: Partial<Draft>) => void }) {
  const set = (defaultMode: DefaultMode) => {
    const p: Partial<Draft> = { defaultMode };
    if (defaultMode === 'fixed' && d.defaultValue === undefined) {
      p.defaultValue = d.type === 'checkbox' ? false : d.type === 'number' ? d.start ?? 0 : d.type === 'percent' ? 50 : undefined;
    }
    onChange(p);
  };
  const rows: { mode: DefaultMode; label: string; hint: string }[] = [
    { mode: 'none', label: 'None — stays empty', hint: 'Empty periods are skipped in Trend' },
    { mode: 'fixed', label: 'Fixed value', hint: 'e.g. 0 glasses, or “No” for a habit' },
    { mode: 'previous', label: 'Previous value', hint: 'Carries over the last logged value' },
  ];
  return (
    <div className="list-box radio-list" role="radiogroup" aria-label="Default value">
      {rows.map((r) => (
        <div key={r.mode} className="radio-block">
          <button role="radio" aria-checked={d.defaultMode === r.mode} className="radio-row" onClick={() => set(r.mode)}>
            <span className={`radio${d.defaultMode === r.mode ? ' on' : ''}`} aria-hidden="true" />
            <span className="radio-text">
              {r.label}
              <small>{r.hint}</small>
            </span>
          </button>
          {r.mode === 'fixed' && d.defaultMode === 'fixed' && (
            <div className="default-value">
              <FixedValueInput draft={d} onChange={(defaultValue) => onChange({ defaultValue })} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FixedValueInput({ draft: d, onChange }: { draft: Draft; onChange: (v: Value | undefined) => void }) {
  const v = d.defaultValue;
  switch (d.type) {
    case 'checkbox':
      return (
        <Segmented<'yes' | 'no'>
          value={v === true ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
          onChange={(x) => onChange(x === 'yes')}
        />
      );
    case 'number':
    case 'percent':
      return (
        <label className="inline-field">
          <input
            inputMode="numeric"
            value={typeof v === 'number' ? String(v) : ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange(e.target.value.trim() === '' || !Number.isFinite(n) ? undefined : n);
            }}
            aria-label="Default value"
          />
          <span>{d.type === 'percent' ? '%' : d.unit}</span>
        </label>
      );
    case 'text':
      return (
        <textarea
          className="inline-textarea"
          rows={2}
          value={typeof v === 'string' ? v : ''}
          placeholder="Template text, e.g. “Grateful for: ”"
          onChange={(e) => onChange(e.target.value)}
          aria-label="Default text"
        />
      );
    case 'choice': {
      const opts = (d.options ?? []).filter((o) => o.label.trim());
      if (!opts.length) return <p className="editor-note">Add options first.</p>;
      const sel = new Set(Array.isArray(v) ? v : typeof v === 'string' ? [v] : []);
      return (
        <div className="chips">
          {opts.map((o) => (
            <button
              key={o.id}
              className={`chip${sel.has(o.id) ? ' on' : ''}`}
              aria-pressed={sel.has(o.id)}
              onClick={() => {
                if (d.multi) {
                  const next = new Set(sel);
                  if (next.has(o.id)) next.delete(o.id);
                  else next.add(o.id);
                  onChange(opts.filter((x) => next.has(x.id)).map((x) => x.id));
                } else onChange(o.id);
              }}
            >
              {sel.has(o.id) && <Icon name="check" size={18} />}
              {o.label}
            </button>
          ))}
        </div>
      );
    }
  }
}
