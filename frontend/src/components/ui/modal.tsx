'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button, type ButtonVariant } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn, lockBodyScroll, trapFocus } from '@/lib/utils';

/* ==========================================================================
   Modal

   Portalled to `document.body`, focus-trapped, Escape-dismissable, and
   scroll-locking. Built by hand rather than pulled from a package so the dialog
   matches the card material exactly and adds no dependency.

   On phones it becomes a bottom sheet: a centred dialog with a form in it is
   awkward to reach one-handed.
   ========================================================================== */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<ModalSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Footer content — usually Cancel plus a primary action. */
  footer?: ReactNode;
  size?: ModalSize;
  icon?: IconName;
  /** Set false for a form with unsaved input, so a stray click cannot discard it. */
  closeOnBackdrop?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  icon,
  closeOnBackdrop = true,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = `${titleId}-description`;
  const [mounted, setMounted] = useState(false);

  // Portals need the DOM, so rendering waits for the client.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const releaseScroll = lockBodyScroll();
    const panel = panelRef.current;
    const releaseFocus = panel ? trapFocus(panel) : () => {};

    // Return focus to whatever opened the dialog when it closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first control, or the panel itself if there is nothing focusable.
    const firstField = panel?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, [data-autofocus]',
    );
    (firstField ?? panel)?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseScroll();
      releaseFocus();
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-ink-950/45 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-scale-in flex-col overflow-hidden rounded-t-2xl bg-surface-card shadow-2xl ring-1 ring-border-subtle focus:outline-none sm:rounded-2xl',
          SIZES[size],
          className,
        )}
      >
        {/* Grab handle, so the sheet reads as draggable-feeling on touch. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-border-default" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          {icon ? (
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <Icon name={icon} size={18} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-content-primary">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-[0.8125rem] leading-relaxed text-content-secondary"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-secondary dark:hover:bg-surface-raised"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>

        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-subtle bg-surface-sunken/50 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ==========================================================================
   Confirm dialog

   Every destructive or irreversible action routes through this, so "are you
   sure?" is never a `window.confirm` and never skipped.
   ========================================================================== */

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'caution';
  icon?: IconName;
  /** Extra detail shown in a muted panel, e.g. what will be kept. */
  detail?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon,
  detail,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);

    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [onConfirm, onClose]);

  const toneTokens: Record<
    NonNullable<ConfirmDialogProps['tone']>,
    { button: ButtonVariant; iconWrap: string; icon: IconName }
  > = {
    danger: {
      button: 'danger',
      iconWrap: 'bg-critical-50 text-critical-600 dark:bg-critical-700/20 dark:text-critical-200',
      icon: 'alert-triangle',
    },
    caution: {
      button: 'primary',
      iconWrap: 'bg-caution-50 text-caution-600 dark:bg-caution-700/20 dark:text-caution-200',
      icon: 'alert-circle',
    },
    primary: {
      button: 'primary',
      iconWrap: 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300',
      icon: 'info',
    },
  };

  const tokens = toneTokens[tone];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button variant={tokens.button} onClick={handleConfirm} loading={submitting} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5 pt-1">
        <span
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            tokens.iconWrap,
          )}
        >
          <Icon name={icon ?? tokens.icon} size={19} />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="text-[0.8125rem] leading-relaxed text-content-secondary">{message}</div>
          {detail ? (
            <div className="rounded-lg bg-surface-sunken px-3 py-2.5 text-xs leading-relaxed text-content-tertiary">
              {detail}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/* ==========================================================================
   Drawer — a side panel for filters and quick detail
   ========================================================================== */

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const releaseScroll = lockBodyScroll();
    const panel = panelRef.current;
    const releaseFocus = panel ? trapFocus(panel) : () => {};
    panel?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseScroll();
      releaseFocus();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/45" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 flex w-full max-w-sm animate-slide-in-right flex-col bg-surface-card shadow-2xl ring-1 ring-border-subtle focus:outline-none',
          side === 'right' ? 'right-0' : 'left-0',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <h2 id={titleId} className="text-sm font-semibold text-content-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-secondary dark:hover:bg-surface-raised"
          >
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="flex shrink-0 gap-2 border-t border-border-subtle bg-surface-sunken/50 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
