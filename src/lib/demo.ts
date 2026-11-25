// Example logs with ~3 months of generated history, so a new user can explore every view.

import { addDays, addMonths, fromKey, periodKeysInRange, startOfMonth, todayKey } from './dates';
import { defaultSettings, type Data, type Entry, type LogDef, type Value } from './model';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIARY = [
  'Long walk by the river after work. Felt calmer than yesterday — the new morning routine seems to help.',
  'First snow on the way home. Tried the new running route.',
  'Quiet Sunday, long breakfast and a nap. Read two chapters.',
  'Busy day at work, too many meetings. Cooked pasta with Sam in the evening.',
  'Slept badly, but the afternoon coffee with Jo cheered me up.',
  'Cleaned the flat and finally fixed the bike light.',
  'Rainy. Stayed in and watched an old film.',
  'Good focus today — finished the report early.',
  'Visited the market, bought too many apples.',
  'Headache in the morning, better after a walk.',
];

const REFLECTIONS = [
  'Good week overall. Sleeping better since I stopped coffee after 2 pm.',
  'Too much screen time this week. Next week: phone out of the bedroom.',
  'Productive, but skipped workouts. Plan them in the calendar.',
  'Lovely weekend with friends. Want more of that.',
];

export function demoData(today = todayKey()): Data {
  const r = rng(42);
  const start = startOfMonth(addMonths(today, -3));
  const created = start;
  let order = 0;
  const L = (def: Omit<LogDef, 'order' | 'createdAt'>): LogDef => ({ ...def, order: order++, createdAt: created });

  const logs: LogDef[] = [
    L({ id: 'meditated', name: 'Meditated', type: 'checkbox', period: 'daily', defaultMode: 'none' }),
    L({ id: 'workout', name: 'Workout', type: 'checkbox', period: 'daily', defaultMode: 'fixed', defaultValue: false }),
    L({ id: 'water', name: 'Water', type: 'number', period: 'daily', input: 'stepper', start: 0, step: 1, unit: 'glasses', defaultMode: 'fixed', defaultValue: 0 }),
    L({ id: 'steps', name: 'Steps', type: 'number', period: 'daily', input: 'keypad', unit: 'steps', defaultMode: 'none' }),
    L({ id: 'mood', name: 'Mood', type: 'percent', period: 'daily', defaultMode: 'previous' }),
    L({
      id: 'sleep', name: 'Sleep quality', type: 'choice', period: 'daily', multi: false, defaultMode: 'none',
      options: [ { id: 'bad', label: 'Bad' }, { id: 'okay', label: 'Okay' }, { id: 'great', label: 'Great' } ],
    }),
    L({
      id: 'ate', name: 'Ate today', type: 'choice', period: 'daily', multi: true, defaultMode: 'none',
      options: [
        { id: 'veg', label: 'Vegetables' }, { id: 'fruit', label: 'Fruit' }, { id: 'sweets', label: 'Sweets' },
        { id: 'coffee', label: 'Coffee' }, { id: 'fastfood', label: 'Fast food' }, { id: 'alcohol', label: 'Alcohol' },
      ],
    }),
    L({ id: 'diary', name: 'Diary', type: 'text', period: 'daily', defaultMode: 'none' }),
    L({ id: 'books', name: 'Books read', type: 'number', period: 'weekly', input: 'keypad', unit: 'books', defaultMode: 'none' }),
    L({ id: 'family', name: 'Called family', type: 'checkbox', period: 'weekly', defaultMode: 'fixed', defaultValue: false }),
    L({ id: 'reflection', name: 'Weekly reflection', type: 'text', period: 'weekly', defaultMode: 'none' }),
    L({ id: 'budget', name: 'Budget kept', type: 'percent', period: 'monthly', defaultMode: 'previous' }),
  ];

  const entries: Record<string, Record<string, Entry>> = {};
  const put = (id: string, k: string, v: Value, hour = 21) => {
    const d = new Date(`${k}T${String(hour).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}:00`);
    (entries[id] ??= {})[k] = { v, t: d.getTime() };
  };

  const days = periodKeysInRange('daily', start, addDays(today, -1));
  let mood = 70;
  for (const [i, k] of days.entries()) {
    const skipDay = r() < 0.06; // the occasional day nothing gets logged
    if (skipDay) continue;
    const weekend = [0, 6].includes(fromKey(k).getDay());
    if (r() < 0.82) put('meditated', k, r() < 0.8, 7);
    if (r() < 0.9) put('workout', k, r() < (weekend ? 0.6 : 0.45), 19);
    if (r() < 0.93) put('water', k, Math.max(2, Math.round(6 + (r() - 0.5) * 6)), 22);
    if (r() < 0.88) put('steps', k, Math.round(9000 + (r() - 0.45) * 7000 + (weekend ? 2000 : 0)), 22);
    mood = Math.max(35, Math.min(95, Math.round(mood + (r() - 0.5) * 18 + (70 - mood) * 0.25)));
    if (r() < 0.8) put('mood', k, mood, 21);
    if (r() < 0.9) put('sleep', k, r() < 0.2 ? 'bad' : r() < 0.55 ? 'okay' : 'great', 8);
    if (r() < 0.75) {
      const ate = ['veg', 'fruit', 'sweets', 'coffee', 'fastfood', 'alcohol'].filter(
        (_, j) => r() < [0.7, 0.6, 0.35, 0.75, 0.15, 0.12][j],
      );
      put('ate', k, ate, 20);
    }
    if (r() < 0.55) put('diary', k, DIARY[(i * 7) % DIARY.length], 22);
  }

  // today: partially logged, like the design
  put('meditated', today, true, 7);
  put('water', today, 6, 12);
  put('steps', today, 8432, 18);
  put('sleep', today, 'great', 8);
  put('ate', today, ['veg', 'fruit', 'coffee'], 13);
  put('diary', today, DIARY[0] + ' Need to call Mum about the weekend.', 21);

  const weeks = periodKeysInRange('weekly', start, today);
  for (const [i, k] of weeks.entries()) {
    const current = i === weeks.length - 1;
    if (current) continue;
    if (r() < 0.85) put('books', k, r() < 0.5 ? 1 : r() < 0.7 ? 0 : 2, 20);
    if (r() < 0.9) put('family', k, r() < 0.7, 18);
    if (r() < 0.7) put('reflection', k, REFLECTIONS[i % REFLECTIONS.length], 21);
  }
  put('reflection', weeks[weeks.length - 1], REFLECTIONS[0], 9);

  const months = periodKeysInRange('monthly', start, today);
  for (const k of months.slice(0, -1)) put('budget', k, Math.round(50 + r() * 40), 20);

  const settings = defaultSettings();
  settings.trend.selected = ['mood', 'water', 'steps', 'meditated'];
  return { version: 1, logs, entries, settings };
}
