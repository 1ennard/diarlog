import { useMemo, useRef, useState } from 'react';
import { useElementWidth } from '../lib/hooks';
import type { ChartModel, FreqRow } from '../lib/trend';

const PLOT_H = 132;
const TOP = 10;
const X_AXIS = 26;
const RIGHT = 10;
const MIN_TICK_GAP = 46;

/**
 * Single-series line or bar chart (SVG). Hover / touch / arrow keys show a crosshair with a tooltip.
 * Empty periods are either bridged (line) / left blank (bar), or — with skipEmpty — already removed
 * from `model.data` so they take no room on the x-axis.
 */
export function Chart({ model, mode, label }: { model: ChartModel; mode: 'line' | 'bar'; label: string }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { data, yMin, yMax, yTicks } = model;
  const n = data.length;

  const left = useMemo(() => {
    const longest = Math.max(...yTicks.map((t) => t.label.length), 1);
    return Math.min(84, 10 + longest * 6.6);
  }, [yTicks]);
  const plotW = Math.max(10, width - left - RIGHT);
  const H = TOP + PLOT_H + X_AXIS;

  const slot = n ? plotW / n : plotW;
  const x = (i: number) => (mode === 'bar' ? left + slot * (i + 0.5) : n <= 1 ? left + plotW / 2 : left + 4 + (i * (plotW - 8)) / (n - 1));
  const y = (v: number) => TOP + PLOT_H - ((v - yMin) / (yMax - yMin || 1)) * PLOT_H;
  const defined = data.map((d, i) => (d.y === undefined ? -1 : i)).filter((i) => i >= 0);

  // thin x ticks so labels never collide
  const xTicks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let lastX = -Infinity;
    for (const t of model.xTicks) {
      const px = x(t.i);
      const w = t.label.length * 6.2;
      if (px - lastX < Math.max(MIN_TICK_GAP, w + 8)) continue;
      if (px + w / 2 > left + plotW + RIGHT) continue;
      out.push(t);
      lastX = px;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.xTicks, width, mode, n]);

  const nearest = (px: number): number | null => {
    if (!defined.length) return null;
    if (mode === 'bar') {
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - left) / slot)));
      if (data[i].y !== undefined) return i;
    }
    let best = defined[0];
    for (const i of defined) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    clearTimeout(hideTimer.current);
    setActive(nearest(e.clientX - r.left));
  };
  const onLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') setActive(null);
    else hideTimer.current = setTimeout(() => setActive(null), 1800);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!defined.length) return;
    const pos = active === null ? -1 : defined.indexOf(active);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = e.key === 'ArrowRight' ? Math.min(defined.length - 1, pos + 1) : pos === -1 ? defined.length - 1 : Math.max(0, pos - 1);
      setActive(defined[next]);
    } else if (e.key === 'Home') setActive(defined[0]);
    else if (e.key === 'End') setActive(defined[defined.length - 1]);
    else if (e.key === 'Escape') setActive(null);
  };

  let path = '';
  if (mode === 'line') path = defined.map((i, j) => `${j ? 'L' : 'M'}${x(i).toFixed(1)},${y(data[i].y!).toFixed(1)}`).join('');
  const last = defined[defined.length - 1];
  const barW = Math.max(1, Math.min(24, slot - 2));
  const base = y(Math.max(yMin, 0));
  const tip = active !== null ? data[active] : null;
  const tipX = active !== null ? x(active) : 0;

  return (
    <div
      className="chart"
      ref={wrapRef}
      tabIndex={0}
      role="img"
      aria-label={label}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={H} onPointerDown={onPointer} onPointerMove={onPointer} onPointerLeave={onLeave} onPointerUp={onLeave}>
          {/* grid + y labels */}
          {yTicks.map((t) => (
            <g key={t.v}>
              <line className="grid" x1={left} x2={left + plotW} y1={y(t.v)} y2={y(t.v)} />
              <text className="axis-label" x={left - 8} y={y(t.v)} dy="0.32em" textAnchor="end">
                {t.label}
              </text>
            </g>
          ))}
          {/* x labels */}
          {xTicks.map((t) => (
            <text key={t.i} className="axis-label" x={x(t.i)} y={TOP + PLOT_H + 18} textAnchor={mode === 'line' && t.i === 0 ? 'start' : 'middle'}>
              {t.label}
            </text>
          ))}

          {active !== null && <line className="crosshair" x1={tipX} x2={tipX} y1={TOP} y2={TOP + PLOT_H} />}

          {mode === 'line' ? (
            <>
              {path && <path className="series-line" d={path} />}
              {defined.length <= 14 &&
                defined.map((i) => i !== last && <circle key={i} className="series-dot" cx={x(i)} cy={y(data[i].y!)} r={4} />)}
              {last !== undefined && <circle className="series-dot" cx={x(last)} cy={y(data[last].y!)} r={4.5} />}
              {active !== null && data[active].y !== undefined && <circle className="series-dot hover" cx={tipX} cy={y(data[active].y!)} r={5.5} />}
            </>
          ) : (
            data.map((d, i) => {
              if (d.y === undefined) return null;
              const top = y(d.y);
              const h = base - top;
              const bx = x(i) - barW / 2;
              if (h < 1) return <rect key={i} className="bar-zero" x={bx} y={base - 2} width={barW} height={2} />;
              const r = Math.min(4, barW / 2, h);
              return (
                <path
                  key={i}
                  className={`bar${active === i ? ' hover' : ''}`}
                  d={`M${bx},${base}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + barW - r}Q${bx + barW},${top} ${bx + barW},${top + r}V${base}Z`}
                />
              );
            })
          )}
          <line className="baseline" x1={left} x2={left + plotW} y1={base} y2={base} />
        </svg>
      )}
      {tip && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(tipX, 70), width - 70) }} aria-hidden="true">
          <strong>{tip.tipValue}</strong>
          <span>{tip.tipDate}</span>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {tip ? `${tip.tipDate}: ${tip.tipValue}` : ''}
      </span>
    </div>
  );
}

/** How often each option of a choice log was picked. */
export function FreqBars({ rows, total }: { rows: FreqRow[]; total: number }) {
  if (!total) return <p className="chart-empty">Nothing logged in this range.</p>;
  return (
    <ul className="freq">
      {rows.map((r) => (
        <li key={r.id} title={`${r.label}: ${r.count} of ${total} (${Math.round(r.pct)} %)`}>
          <span className="freq-label">{r.label}</span>
          <span className="freq-track">
            <span className="freq-fill" style={{ width: `${r.pct}%` }} />
          </span>
          <span className="freq-value">
            {r.count} · {Math.round(r.pct)} %
          </span>
        </li>
      ))}
    </ul>
  );
}
