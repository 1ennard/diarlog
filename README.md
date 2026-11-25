# Diarlog

Low-effort logging for anything: habits, numbers, mood, choices and a diary — with a calendar history and trend charts.
A local-first web app (installable as a PWA); all data stays in your browser.

## Features

**Log types** — each log is an instance of a type, with a name, a time period and a default value:

| Type | How you log |
|---|---|
| Checkbox | tap to toggle *Done* |
| Number (whole numbers) | **Stepper** (− / + from a start value, configurable step) or **Keypad**; tap the number to type it |
| Percent | slider 0–100 % |
| Text | free text field (diary, notes) — autosaves |
| Choice | single choice (segmented buttons) or multiple choice (chips) |

- **Time period**: daily, weekly or monthly. Weekly logs belong to the week (Mon–Sun), monthly logs to the month.
- **Default value** (shown when nothing is logged): *None* (stays empty), a *fixed value* (e.g. `0` glasses, `No`), or the *previous value*.
  Cards show when a value was logged (`21:14`, `Mon 09:04`, `16 Nov`) or that a default is shown (`Default · 0`, `Prefilled from yesterday`); tap the default label to keep it as a logged value.

**Today** — a grid of log cards: *Daily*, *This week*, *This month*. Long-press (or right-click / ⋮ on desktop) a card for:
Edit log · Change default value · Duplicate · Reorder · Show in Trend · Clear value · Delete (with undo).

**History** — a month calendar. Rings show how many daily logs were filled; `W` / `M` mark the first day of a week / month, where weekly and monthly logs live.
Tap a day to see its values, then open it to edit (phone: bottom sheet with ‹ › to step through days; desktop: side panel). Search finds text in everything you logged.

**Trend** — pick logs (with search), a range (Week / Month / Year / custom, with ‹ › to move back in time) and plot as **Line**, **Bar** or **Table**.
- *Skip days without logs* — off (default): lines connect across empty days on a continuous time axis. On: days without a value are removed from the x-axis.
- Checkboxes plot as a rolling done-rate (line) or done/not done per day (bar); single choice plots options in their order; multiple choice shows how often each option was picked.
- Long ranges of daily logs (more than ~3 months) are shown as weekly averages.

**Data** — stored in `localStorage` on the device. The ⋮ menu has *Export backup (JSON)*, *Export values (CSV)*, *Import backup*, *Load example data*, *Delete all data* and the theme (system / light / dark).

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (vitest)
npm run build    # type-check + production build into dist/
```

Stack: React 18 + TypeScript + Vite, no UI or chart libraries (charts are hand-written SVG). Icons from `@mdi/js`, font Roboto via `@fontsource`.

```
src/
  lib/        model, dates/periods, value resolution, store (localStorage), trend series, demo data
  components/ log cards, editor sheet, overlays (sheet, menu, snackbar), chart, search
  pages/      Today, History, Trend
  styles/     Material 3 colour tokens (light/dark) and app styles
```

## Deploy

`dist/` is a static site that works from any sub-path. `.github/workflows/pages.yml` builds and deploys to GitHub Pages on pushes to `main`
(enable it under *Settings → Pages → Source: GitHub Actions*).
