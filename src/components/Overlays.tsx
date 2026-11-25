import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { runAfterOverlayClose, useBackToClose } from '../lib/hooks';
import { Icon, type IconName } from './Icon';

// ---------- Sheet: bottom sheet on phones, dialog on wide screens ----------

export function Sheet({
  open,
  onClose,
  label,
  children,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  useBackToClose(open, onClose);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="overlay">
      <div className="scrim" onClick={onClose} />
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Menu: anchored popover ----------

export interface MenuItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
  divider?: boolean;
  checked?: boolean;
}

export function Menu({ anchor, items, onClose, label }: { anchor: DOMRect; items: MenuItem[]; onClose: () => void; label: string }) {
  useBackToClose(true, onClose);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    let top: number;
    if (anchor.top - m.height - pad > 0) top = anchor.top - m.height - 4; // above the card, like the draft
    else if (anchor.bottom + m.height + pad < vh) top = anchor.bottom + 4;
    else top = Math.max(pad, (vh - m.height) / 2);
    const left = Math.min(Math.max(pad, anchor.left), vw - m.width - pad);
    setPos({ top, left });
    el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const btns = [...(ref.current?.querySelectorAll<HTMLElement>('button') ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLElement);
        btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus();
      }
    };
    const onScroll = () => onClose();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose]);

  return createPortal(
    <div className="overlay menu-overlay">
      <div className="scrim light" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="menu"
        role="menu"
        aria-label={label}
        ref={ref}
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
      >
        {items.map((it) => (
          <div key={it.label}>
            {it.divider && <hr className="menu-divider" />}
            <button
              role="menuitem"
              className={`menu-item${it.danger ? ' danger' : ''}`}
              onClick={() => {
                onClose();
                // let the menu's history entry pop before the action opens anything new
                runAfterOverlayClose(it.onSelect);
              }}
            >
              <Icon name={it.icon} size={22} />
              <span>{it.label}</span>
              {it.checked && <Icon name="check" size={20} className="menu-check" />}
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Snackbar ----------

export interface Snack {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export function Snackbar({ snack, onDone }: { snack: Snack | null; onDone: () => void }) {
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(onDone, snack.action ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [snack, onDone]);
  if (!snack) return null;
  return (
    <div className="snackbar" role="status" key={snack.id}>
      <span>{snack.message}</span>
      {snack.action && (
        <button
          className="snackbar-action"
          onClick={() => {
            snack.action!.run();
            onDone();
          }}
        >
          {snack.action.label}
        </button>
      )}
    </div>
  );
}

// ---------- Confirm dialog ----------

export function Confirm({
  open,
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title} className="dialog-small">
      <div className="dialog-body">
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-text">{text}</p>
        <div className="dialog-actions">
          <button className="btn text" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'danger' : 'filled'}`}
            onClick={() => {
              onClose();
              runAfterOverlayClose(onConfirm);
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
