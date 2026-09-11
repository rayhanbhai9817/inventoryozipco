'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Toasts

   Every action in the product reports its outcome. `useToast()` is the single
   way to do that, so feedback is consistent and nothing succeeds silently.

   The live region is `polite` for success and `assertive` for errors, so a
   failure interrupts a screen reader while a confirmation waits its turn.
   ========================================================================== */

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** One optional action, e.g. "Undo" or "View product". */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before auto-dismiss. `0` keeps it until dismissed. */
  duration: number;
}

type ToastInput = Omit<Partial<Toast>, 'id' | 'tone' | 'title'> & {
  title: string;
  tone?: ToastTone;
};

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastTone, number> = {
  success: 4000,
  info: 4500,
  warning: 6000,
  // Errors stay until dismissed: the user may need to read the detail or copy it.
  error: 0,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const tone = input.tone ?? 'info';
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = input.duration ?? DEFAULT_DURATIONS[tone];

      setToasts((current) => {
        const next = [...current, { ...input, id, tone, duration }];
        // Cap the stack so a burst of failures cannot bury the page.
        return next.slice(-4);
      });

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  // Clear outstanding timers if the provider unmounts mid-flight.
  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (title, description) => push({ tone: 'success', title, description }),
      error: (title, description) => push({ tone: 'error', title, description }),
      info: (title, description) => push({ tone: 'info', title, description }),
      warning: (title, description) => push({ tone: 'warning', title, description }),
    }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>.');
  }

  return context;
}

/* ==========================================================================
   Viewport
   ========================================================================== */

const TONE_TOKENS: Record<ToastTone, { icon: IconName; iconWrap: string }> = {
  success: {
    icon: 'check-circle',
    iconWrap: 'bg-positive-50 text-positive-600 dark:bg-positive-700/20 dark:text-positive-200',
  },
  error: {
    icon: 'alert-circle',
    iconWrap: 'bg-critical-50 text-critical-600 dark:bg-critical-700/20 dark:text-critical-200',
  },
  warning: {
    icon: 'alert-triangle',
    iconWrap: 'bg-caution-50 text-caution-600 dark:bg-caution-700/20 dark:text-caution-200',
  },
  info: { icon: 'info', iconWrap: 'bg-info-50 text-info-600 dark:bg-info-700/20 dark:text-info-200' },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const errors = toasts.filter((toast) => toast.tone === 'error');
  const others = toasts.filter((toast) => toast.tone !== 'error');

  return (
    <>
      {/* Two regions so errors can be assertive without making every
          confirmation interrupt the user. */}
      <div className="sr-only" role="status" aria-live="polite">
        {others.map((toast) => (
          <p key={toast.id}>{[toast.title, toast.description].filter(Boolean).join('. ')}</p>
        ))}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive">
        {errors.map((toast) => (
          <p key={toast.id}>{[toast.title, toast.description].filter(Boolean).join('. ')}</p>
        ))}
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
        aria-hidden={toasts.length === 0}
      >
        {toasts.map((toast) => {
          const tokens = TONE_TOKENS[toast.tone];

          return (
            <div
              key={toast.id}
              className="card-surface pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 p-3.5 shadow-lg"
            >
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  tokens.iconWrap,
                )}
              >
                <Icon name={tokens.icon} size={17} />
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[0.8125rem] leading-snug font-semibold text-content-primary">
                  {toast.title}
                </p>
                {toast.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                    {toast.description}
                  </p>
                ) : null}
                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      onDismiss(toast.id);
                    }}
                    className="mt-2 text-xs font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
                  >
                    {toast.action.label}
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mt-0.5 -mr-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-secondary dark:hover:bg-surface-raised"
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
