import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * The card is the primary container in the dashboard. Its look — hairline ring
 * plus a very soft shadow — is defined once in `globals.css` as `card-surface`,
 * so cards, popovers and modals all read as the same material.
 */

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Removes the default padding, for cards whose body is a flush table. */
  flush?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}

export function Card({ children, className, flush = false, as: Tag = 'div' }: CardProps) {
  return (
    <Tag className={cn('card-surface overflow-hidden', !flush && 'p-5', className)}>{children}</Tag>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Actions on the right — buttons, a filter, a menu. */
  actions?: ReactNode;
  icon?: IconName;
  className?: string;
  /** Use inside a `flush` card, where the header needs its own padding. */
  padded?: boolean;
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
  padded = false,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3',
        padded && 'border-b border-border-subtle px-5 py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <Icon name={icon} size={17} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[0.9375rem] font-semibold text-content-primary">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-content-secondary">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cn(padded && 'px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle',
        padded ? 'px-5 py-3.5' : 'pt-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   KPI tile
   ========================================================================== */

export type KpiTone = 'neutral' | 'brand' | 'positive' | 'caution' | 'critical' | 'info';

const KPI_TONES: Record<KpiTone, { chip: string; accent: string }> = {
  neutral: { chip: 'bg-ink-100 text-ink-700 dark:bg-surface-raised dark:text-ink-200', accent: 'from-ink-300' },
  brand: {
    chip: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200',
    accent: 'from-brand-400',
  },
  positive: {
    chip: 'bg-positive-50 text-positive-700 dark:bg-positive-700/15 dark:text-positive-100',
    accent: 'from-positive-500',
  },
  caution: {
    chip: 'bg-caution-50 text-caution-700 dark:bg-caution-700/15 dark:text-caution-100',
    accent: 'from-caution-500',
  },
  critical: {
    chip: 'bg-critical-50 text-critical-700 dark:bg-critical-700/15 dark:text-critical-100',
    accent: 'from-critical-500',
  },
  info: {
    chip: 'bg-info-50 text-info-700 dark:bg-info-700/15 dark:text-info-100',
    accent: 'from-info-500',
  },
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Secondary line under the value. */
  caption?: ReactNode;
  icon: IconName;
  tone?: KpiTone;
  /** Period-over-period change. `direction` says which way is good. */
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; goodWhen?: 'up' | 'down' };
  /** Sparkline values, rendered as a minimal area chart behind the figure. */
  trend?: number[];
  href?: string;
  className?: string;
}

export function KpiCard({
  label,
  value,
  caption,
  icon,
  tone = 'neutral',
  delta,
  trend,
  className,
}: KpiCardProps) {
  const tokens = KPI_TONES[tone];

  return (
    <div className={cn('card-surface group relative overflow-hidden p-4', className)}>
      {/* A very faint tinted wash in the corner, to tell tiles apart at a glance
          without colouring the whole card. */}
      <div
        className={cn(
          'pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-[0.07] transition-opacity duration-300 group-hover:opacity-[0.13]',
          tokens.accent,
        )}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="text-[0.8125rem] font-medium text-content-secondary">{label}</span>
        <span
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            tokens.chip,
          )}
        >
          <Icon name={icon} size={15} />
        </span>
      </div>

      <div className="relative mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-display text-[1.75rem] leading-none font-semibold tracking-tight text-content-primary"
            data-numeric
          >
            {value}
          </p>
          {caption || delta ? (
            <div className="mt-1.5 flex items-center gap-2">
              {delta ? <DeltaBadge {...delta} /> : null}
              {caption ? (
                <span className="truncate text-xs text-content-tertiary">{caption}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {trend && trend.length > 1 ? (
          <Sparkline values={trend} tone={tone} className="shrink-0" />
        ) : null}
      </div>
    </div>
  );
}

function DeltaBadge({
  value,
  direction,
  goodWhen = 'up',
}: NonNullable<KpiCardProps['delta']>) {
  if (direction === 'flat') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-content-secondary dark:bg-surface-raised">
        <Icon name="minus" size={11} />
        {value}
      </span>
    );
  }

  const isGood = direction === goodWhen;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold',
        isGood
          ? 'bg-positive-50 text-positive-700 dark:bg-positive-700/15 dark:text-positive-100'
          : 'bg-critical-50 text-critical-700 dark:bg-critical-700/15 dark:text-critical-100',
      )}
    >
      <Icon name={direction === 'up' ? 'trending-up' : 'trending-down'} size={11} />
      {value}
    </span>
  );
}

/**
 * Minimal area sparkline. Inline SVG rather than a charting library — for 20
 * points inside a tile, a dependency would cost more than it gives.
 */
export function Sparkline({
  values,
  tone = 'brand',
  width = 72,
  height = 32,
  className,
}: {
  values: number[];
  tone?: KpiTone;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    // Inset by 2px top and bottom so the stroke is never clipped.
    const y = height - 2 - ((value - min) / range) * (height - 4);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const strokeColours: Record<KpiTone, string> = {
    neutral: 'text-ink-400',
    brand: 'text-brand-500',
    positive: 'text-positive-500',
    caution: 'text-caution-500',
    critical: 'text-critical-500',
    info: 'text-info-500',
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(strokeColours[tone], className)}
      aria-hidden
    >
      <polyline
        points={`0,${height} ${points.join(' ')} ${width},${height}`}
        fill="currentColor"
        fillOpacity="0.1"
        stroke="none"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ==========================================================================
   Stat row — compact label/value pairs for detail panels
   ========================================================================== */

export function StatList({
  items,
  className,
  columns = 1,
}: {
  items: Array<{ label: string; value: ReactNode; hint?: string }>;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  const gridClass =
    columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1';

  return (
    <dl className={cn('grid gap-x-6 gap-y-4', gridClass, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-medium break-words text-content-primary" data-numeric>
            {item.value}
          </dd>
          {item.hint ? (
            <dd className="mt-0.5 text-xs text-content-tertiary">{item.hint}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
