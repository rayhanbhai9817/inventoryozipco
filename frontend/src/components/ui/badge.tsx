import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import type { MovementTypeKey, RoleKey, StockStatusKey } from '@/types/api';
import { cn } from '@/lib/utils';

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'positive'
  | 'caution'
  | 'critical'
  | 'info'
  | 'ember';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200 dark:bg-surface-raised dark:text-ink-200 dark:ring-border-subtle',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-800',
  positive:
    'bg-positive-50 text-positive-700 ring-positive-500/20 dark:bg-positive-700/15 dark:text-positive-100 dark:ring-positive-500/30',
  caution:
    'bg-caution-50 text-caution-700 ring-caution-500/20 dark:bg-caution-700/15 dark:text-caution-100 dark:ring-caution-500/30',
  critical:
    'bg-critical-50 text-critical-700 ring-critical-500/20 dark:bg-critical-700/15 dark:text-critical-100 dark:ring-critical-500/30',
  info: 'bg-info-50 text-info-700 ring-info-500/20 dark:bg-info-700/15 dark:text-info-100 dark:ring-info-500/30',
  ember:
    'bg-ember-50 text-ember-700 ring-ember-500/20 dark:bg-ember-700/15 dark:text-ember-100 dark:ring-ember-500/30',
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: IconName;
  /** Small coloured dot instead of an icon — good for status in dense tables. */
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
  dot = false,
  size = 'sm',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-xs',
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      ) : icon ? (
        <Icon name={icon} size={size === 'sm' ? 11 : 13} />
      ) : null}
      {children}
    </span>
  );
}

/* ==========================================================================
   Domain-specific badges

   Mapping domain state to a tone in one place means stock status looks identical
   on the dashboard, in a table and on a detail page.
   ========================================================================== */

const STOCK_TONES: Record<StockStatusKey, BadgeTone> = {
  in_stock: 'positive',
  low_stock: 'caution',
  out_of_stock: 'critical',
};

export function StockStatusBadge({
  status,
  label,
  size = 'sm',
}: {
  status: StockStatusKey;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const fallback: Record<StockStatusKey, string> = {
    in_stock: 'In stock',
    low_stock: 'Low stock',
    out_of_stock: 'Out of stock',
  };

  return (
    <Badge tone={STOCK_TONES[status]} dot size={size}>
      {label ?? fallback[status]}
    </Badge>
  );
}

const MOVEMENT_TONES: Record<MovementTypeKey, { tone: BadgeTone; icon: IconName }> = {
  stock_in: { tone: 'positive', icon: 'arrow-down-right' },
  stock_out: { tone: 'info', icon: 'arrow-up-right' },
  adjustment: { tone: 'caution', icon: 'sliders' },
};

export function MovementTypeBadge({
  type,
  label,
  size = 'sm',
}: {
  type: MovementTypeKey;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const fallback: Record<MovementTypeKey, string> = {
    stock_in: 'Stock in',
    stock_out: 'Stock out',
    adjustment: 'Adjustment',
  };

  const tokens = MOVEMENT_TONES[type];

  return (
    <Badge tone={tokens.tone} icon={tokens.icon} size={size}>
      {label ?? fallback[type]}
    </Badge>
  );
}

const ROLE_TONES: Record<RoleKey, BadgeTone> = {
  owner: 'brand',
  manager: 'info',
  staff: 'neutral',
};

export function RoleBadge({ role, label }: { role: RoleKey; label?: string }) {
  const fallback: Record<RoleKey, string> = { owner: 'Owner', manager: 'Manager', staff: 'Staff' };

  return (
    <Badge tone={ROLE_TONES[role]} icon={role === 'owner' ? 'shield' : undefined}>
      {label ?? fallback[role]}
    </Badge>
  );
}

/** Active / inactive, used for suppliers, categories and users. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'positive' : 'neutral'} dot>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

/**
 * A category chip that honours the colour the business chose for it, falling
 * back to the neutral badge when no colour is set.
 */
export function CategoryChip({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  if (!color) {
    return (
      <Badge tone="neutral" className={className}>
        {name}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap ring-1 ring-inset',
        className,
      )}
      style={{
        // `color-mix` keeps the chip legible whatever hue the user picked,
        // instead of trusting arbitrary input to have enough contrast.
        backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
        color: `color-mix(in oklab, ${color} 72%, var(--text-primary))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 24%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {name}
    </span>
  );
}

/** Small count bubble for the notification bell and nav items. */
export function CountBubble({
  count,
  max = 99,
  tone = 'critical',
  className,
}: {
  count: number;
  max?: number;
  tone?: 'critical' | 'brand' | 'neutral';
  className?: string;
}) {
  if (count <= 0) return null;

  const tones = {
    critical: 'bg-critical-500 text-white',
    brand: 'bg-brand-600 text-white',
    neutral: 'bg-ink-200 text-ink-700 dark:bg-surface-raised dark:text-ink-200',
  };

  return (
    <span
      className={cn(
        'inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold',
        tones[tone],
        className,
      )}
      data-numeric
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
