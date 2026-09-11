import type { ReactNode } from 'react';

import { Button, ButtonLink, Spinner } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { SkeletonBar } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/* ==========================================================================
   The four states every data surface needs: empty, loading, error, success.

   Collected here so they look the same everywhere and so no screen is tempted to
   render a bare "No data" string.
   ========================================================================== */

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  /** Primary call to action. An empty state without a next step is a dead end. */
  action?: { label: string; href?: string; onClick?: () => void; icon?: IconName };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  /** Compact variant for inside a card or a table. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon = 'package',
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      {/* The faint grid behind the glyph ties empty states to the marketing
          hero, so the product feels like one piece of design. */}
      <div className="relative mb-5">
        <div
          className="grid-backdrop absolute -inset-8 opacity-50 [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]"
          aria-hidden
        />
        <span
          className={cn(
            'relative inline-flex items-center justify-center rounded-2xl bg-surface-card text-brand-600 ring-1 ring-border-subtle dark:text-brand-300',
            compact ? 'h-12 w-12' : 'h-14 w-14',
          )}
        >
          <Icon name={icon} size={compact ? 22 : 26} />
        </span>
      </div>

      <h3
        className={cn(
          'font-semibold text-content-primary',
          compact ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </h3>

      {description ? (
        <p
          className={cn(
            'mt-1.5 max-w-sm leading-relaxed text-content-secondary',
            compact ? 'text-xs' : 'text-[0.8125rem]',
          )}
        >
          {description}
        </p>
      ) : null}

      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action ? (
            action.href ? (
              <ButtonLink href={action.href} size={compact ? 'sm' : 'md'} icon={action.icon}>
                {action.label}
              </ButtonLink>
            ) : (
              <Button onClick={action.onClick} size={compact ? 'sm' : 'md'} icon={action.icon}>
                {action.label}
              </Button>
            )
          ) : null}
          {secondaryAction ? (
            secondaryAction.href ? (
              <ButtonLink
                href={secondaryAction.href}
                variant="ghost"
                size={compact ? 'sm' : 'md'}
              >
                {secondaryAction.label}
              </ButtonLink>
            ) : (
              <Button
                onClick={secondaryAction.onClick}
                variant="ghost"
                size={compact ? 'sm' : 'md'}
              >
                {secondaryAction.label}
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Error state
   ========================================================================== */

export interface ErrorStateProps {
  title?: string;
  /** Already-friendly message. Raw technical detail never reaches here. */
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'We could not load this',
  message = 'Something went wrong on our side. Please try again.',
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-6 py-10' : 'px-6 py-14',
        className,
      )}
      role="alert"
    >
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-critical-50 text-critical-600 dark:bg-critical-700/15 dark:text-critical-200">
        <Icon name="alert-triangle" size={22} />
      </span>
      <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[0.8125rem] leading-relaxed text-content-secondary">
        {message}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Loading
   ========================================================================== */

export function LoadingState({
  label = 'Loading…',
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-content-tertiary',
        compact ? 'py-10' : 'py-16',
        className,
      )}
      aria-busy
      aria-live="polite"
    >
      <Spinner size={compact ? 20 : 24} className="text-brand-500" />
      <p className="text-[0.8125rem]">{label}</p>
    </div>
  );
}

/** Card-shaped skeleton, for KPI rows and panels while the dashboard loads. */
export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('card-surface space-y-3 p-5', className)} aria-busy>
      <SkeletonBar className="w-28" />
      <SkeletonBar className="h-6 w-20" />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, index) => (
        <SkeletonBar key={index} className={index % 2 ? 'w-2/3' : 'w-5/6'} />
      ))}
    </div>
  );
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-surface space-y-3 p-4" aria-busy>
          <div className="flex items-start justify-between">
            <SkeletonBar className="w-24" />
            <SkeletonBar className="h-7 w-7 rounded-lg" />
          </div>
          <SkeletonBar className="h-7 w-24" />
          <SkeletonBar className="w-16" />
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   Alert — inline, persistent messaging inside a page or form
   ========================================================================== */

export type AlertTone = 'info' | 'positive' | 'caution' | 'critical' | 'brand';

const ALERT_TOKENS: Record<AlertTone, { wrap: string; icon: IconName; iconColor: string }> = {
  info: {
    wrap: 'bg-info-50 ring-info-500/20 dark:bg-info-700/10 dark:ring-info-500/25',
    icon: 'info',
    iconColor: 'text-info-600 dark:text-info-300',
  },
  positive: {
    wrap: 'bg-positive-50 ring-positive-500/20 dark:bg-positive-700/10 dark:ring-positive-500/25',
    icon: 'check-circle',
    iconColor: 'text-positive-600 dark:text-positive-300',
  },
  caution: {
    wrap: 'bg-caution-50 ring-caution-500/20 dark:bg-caution-700/10 dark:ring-caution-500/25',
    icon: 'alert-triangle',
    iconColor: 'text-caution-600 dark:text-caution-300',
  },
  critical: {
    wrap: 'bg-critical-50 ring-critical-500/20 dark:bg-critical-700/10 dark:ring-critical-500/25',
    icon: 'alert-circle',
    iconColor: 'text-critical-600 dark:text-critical-300',
  },
  brand: {
    wrap: 'bg-brand-50 ring-brand-500/20 dark:bg-brand-950/60 dark:ring-brand-700/40',
    icon: 'sparkles',
    iconColor: 'text-brand-600 dark:text-brand-300',
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  icon?: IconName;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}

export function Alert({
  tone = 'info',
  title,
  children,
  icon,
  onDismiss,
  action,
  className,
}: AlertProps) {
  const tokens = ALERT_TOKENS[tone];

  return (
    <div
      className={cn('flex gap-3 rounded-xl p-3.5 ring-1 ring-inset', tokens.wrap, className)}
      role={tone === 'critical' ? 'alert' : 'status'}
    >
      <Icon name={icon ?? tokens.icon} size={18} className={cn('mt-px shrink-0', tokens.iconColor)} />
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-[0.8125rem] font-semibold text-content-primary">{title}</p>
        ) : null}
        {children ? (
          <div
            className={cn(
              'text-[0.8125rem] leading-relaxed text-content-secondary',
              title && 'mt-0.5',
            )}
          >
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mt-0.5 -mr-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-black/5 hover:text-content-secondary dark:hover:bg-white/10"
        >
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Section header — the heading block above a page's content
   ========================================================================== */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-display-xs font-semibold text-content-primary sm:text-display-sm">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-content-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
