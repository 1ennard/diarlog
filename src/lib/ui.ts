import { createContext, useContext } from 'react';
import type { LogDef } from './model';

export interface UiActions {
  /** Open the long-press menu for a log card. */
  openLogMenu(log: LogDef, periodKey: string, anchor: HTMLElement): void;
  /** Open the editor: `null` = new log. */
  openEditor(logId: string | null, focus?: 'default'): void;
  /** Open the day sheet / panel for a date (History). */
  openDay(date: string): void;
  openSearch(): void;
  showSnack(message: string, action?: { label: string; run: () => void }): void;
  reorderingPeriod: string | null;
  setReordering(period: string | null): void;
}

export const UiContext = createContext<UiActions | null>(null);

export function useUi(): UiActions {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('UiContext missing');
  return ctx;
}
