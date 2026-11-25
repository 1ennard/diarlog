import { useMemo, useState } from 'react';
import { fmtDayMonthYear, fmtRange, endOfWeek, fmtMonthYear } from '../lib/dates';
import { sortedLogs, useData } from '../lib/store';
import { formatValue } from '../lib/values';
import { Icon, typeIcon } from './Icon';

interface Hit {
  logId: string;
  logName: string;
  type: Parameters<typeof typeIcon>[0];
  key: string;
  when: string;
  text: string;
  match: [number, number] | null;
}

/** Full-text search through everything that was logged (diary text, choices, names). */
export function SearchSheet({ onClose, onOpenDay }: { onClose: () => void; onOpenDay: (date: string) => void }) {
  const data = useData();
  const [q, setQ] = useState('');

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out: Hit[] = [];
    for (const log of sortedLogs(data)) {
      const nameHit = log.name.toLowerCase().includes(needle);
      const entries = data.entries[log.id] ?? {};
      for (const [key, e] of Object.entries(entries)) {
        const text = formatValue(log, e.v);
        const idx = text.toLowerCase().indexOf(needle);
        if (idx < 0 && !nameHit) continue;
        const when = log.period === 'daily' ? fmtDayMonthYear(key) : log.period === 'weekly' ? fmtRange(key, endOfWeek(key)) : fmtMonthYear(key);
        out.push({ logId: log.id, logName: log.name, type: log.type, key, when, text, match: idx >= 0 ? [idx, idx + needle.length] : null });
      }
    }
    // value matches first, newest first
    out.sort((a, b) => (a.match && !b.match ? -1 : !a.match && b.match ? 1 : b.key.localeCompare(a.key)));
    return out.slice(0, 200);
  }, [data, q]);

  return (
    <div className="search-sheet">
      <div className="search-head">
        <button className="icon-btn" aria-label="Close search" onClick={onClose}>
          <Icon name="back" />
        </button>
        <input
          className="search-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your logs and diary"
          aria-label="Search your logs"
        />
        {q && (
          <button className="icon-btn" aria-label="Clear" onClick={() => setQ('')}>
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="search-results" aria-live="polite">
        {q.trim().length < 2 ? (
          <p className="search-hint">Search through diary entries, notes, choices and log names.</p>
        ) : hits.length === 0 ? (
          <p className="search-hint">Nothing found for “{q.trim()}”.</p>
        ) : (
          <ul>
            {hits.map((h) => (
              <li key={`${h.logId}|${h.key}`}>
                <button className="search-hit" onClick={() => onOpenDay(h.key)}>
                  <Icon name={typeIcon(h.type)} size={20} />
                  <span className="hit-main">
                    <span className="hit-top">
                      <span className="hit-log">{h.logName}</span>
                      <span className="hit-when">{h.when}</span>
                    </span>
                    <span className="hit-text">{snippet(h)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function snippet(h: Hit): React.ReactNode {
  if (!h.match) return h.text.length > 120 ? h.text.slice(0, 118) + '…' : h.text;
  const [a, b] = h.match;
  const start = Math.max(0, a - 40);
  const end = Math.min(h.text.length, b + 70);
  return (
    <>
      {start > 0 && '…'}
      {h.text.slice(start, a)}
      <mark>{h.text.slice(a, b)}</mark>
      {h.text.slice(b, end)}
      {end < h.text.length && '…'}
    </>
  );
}
