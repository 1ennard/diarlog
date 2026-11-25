import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { todayKey } from './dates';

/** Today's date key; rolls over at midnight and when the tab becomes visible again. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday(todayKey());
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 500;
    const t = setTimeout(check, msToMidnight);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, [today]);
  return today;
}

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}

export const WIDE_QUERY = '(min-width: 840px)';
export const useIsWide = () => useMediaQuery(WIDE_QUERY);

/** Width of an element, tracked with ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(): [React.RefCallback<T>, number] {
  const [width, setWidth] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect();
    if (!el) return;
    setWidth(el.clientWidth);
    ro.current = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.current.observe(el);
  }, []);
  return [ref, width];
}

/**
 * Long-press (touch / pen / mouse hold) and right-click detection.
 * Long presses that start inside text fields are ignored so text selection keeps working.
 */
export function useLongPress(onLongPress: (el: HTMLElement) => void, ms = 480) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cb = useRef(onLongPress);
  cb.current = onLongPress;

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      fired.current = false;
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('textarea, input, [data-no-longpress]')) return;
      start.current = { x: e.clientX, y: e.clientY };
      const el = e.currentTarget;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        start.current = null;
        navigator.vibrate?.(10);
        cb.current(el);
      }, ms);
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(e: React.MouseEvent<HTMLElement>) {
      if ((e.target as HTMLElement).closest('textarea, input')) return;
      e.preventDefault();
      cancel();
      if (!fired.current) {
        fired.current = true;
        cb.current(e.currentTarget);
      }
    },
    /** Swallow the click that follows a long press. */
    onClickCapture(e: React.MouseEvent<HTMLElement>) {
      if (fired.current) {
        e.stopPropagation();
        e.preventDefault();
        fired.current = false;
      }
    },
  };
}

// ---------- overlays & the browser back button ----------

const overlayStack: { id: number; close: () => void }[] = [];
let overlaySeq = 0;
let pendingBacks = 0;
let afterBack: (() => void)[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (pendingBacks > 0) {
      pendingBacks--;
      if (pendingBacks === 0) {
        const fns = afterBack;
        afterBack = [];
        fns.forEach((f) => f());
      }
      return;
    }
    const top = overlayStack[overlayStack.length - 1];
    if (top && history.state?.overlay !== top.id) top.close();
  });
}

/** Run `fn` once overlays that just closed have popped their history entries. */
export function runAfterOverlayClose(fn: () => void) {
  // let React run effect cleanups (which call history.back()) first
  setTimeout(() => {
    if (pendingBacks > 0) afterBack.push(fn);
    else fn();
  }, 0);
}

/** While `open`, the browser/Android back button closes the overlay instead of leaving the page. */
export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const id = ++overlaySeq;
    let poppedByBrowser = false;
    const entry = {
      id,
      close: () => {
        poppedByBrowser = true;
        closeRef.current();
      },
    };
    history.pushState({ ...(history.state ?? {}), overlay: id }, '');
    overlayStack.push(entry);
    return () => {
      const i = overlayStack.indexOf(entry);
      if (i >= 0) overlayStack.splice(i, 1);
      if (!poppedByBrowser && history.state?.overlay === id) {
        pendingBacks++;
        history.back();
      }
    };
  }, [open]);
}

// ---------- hash routing ----------

export type Route = { page: 'today' | 'history' | 'trend'; date?: string };

function parseHash(): Route {
  const [, page, date] = location.hash.replace(/^#/, '').split('/');
  if (page === 'history' || page === 'trend') return { page, date };
  return { page: 'today', date: page === 'today' ? date : undefined };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    () => location.hash,
    () => '',
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemoRoute(hash);
}

let lastHash: string | null = null;
let lastRoute: Route = { page: 'today' };
function useMemoRoute(hash: string): Route {
  if (hash !== lastHash) {
    lastHash = hash;
    lastRoute = parseHash();
  }
  return lastRoute;
}

export function navigate(page: Route['page'], date?: string) {
  const next = `#/${page}${date ? '/' + date : ''}`;
  if (location.hash !== next) location.hash = next;
}
