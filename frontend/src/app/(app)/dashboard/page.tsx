'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CategoryChip, StockStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, KpiCard } from '@/components/ui/card';
import { DonutChart, HorizontalBarChart, MovementTrendChart } from '@/components/ui/chart';
import { Icon, type IconName } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/tabs';
import {
  Alert,
  EmptyState,
  ErrorState,
  KpiRowSkeleton,
  CardSkeleton,
  PageHeader,
} from '@/components/ui/states';
import { fetchDashboard } from '@/lib/data-source';
import { useAuth } from '@/lib/auth';
import { formatCompact, formatQuantity, formatRelative, formatSigned } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { AuditLogEntry, PermissionKey, Product, StockMovement } from '@/types/api';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const;

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  const { data, loading, error, reload } = useAsync(() => fetchDashboard(Number(period)), [period]);

  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          data
            ? describeAttention(data.kpis.low_stock_count, data.kpis.out_of_stock_count)
            : 'Here is where your inventory stands.'
        }
        actions={
          <>
            <SegmentedControl
              aria-label="Reporting period"
              options={[...PERIOD_OPTIONS]}
              value={period}
              onChange={setPeriod}
            />
            {can('inventory.stock-in') ? (
              <ButtonLink href="/stock-in?new=1" icon="arrow-down-right" size="sm">
                Stock in
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : null}

      {/* ---------- KPI row ---------- */}
      {loading && !data ? (
        <KpiRowSkeleton count={4} />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total products"
              value={formatQuantity(data.kpis.total_products)}
              caption={`${data.kpis.categories_count} categories`}
              icon="package"
              tone="brand"
            />
            <KpiCard
              label="Units on hand"
              value={formatCompact(data.kpis.total_inventory_units)}
              caption="Across all open batches"
              icon="boxes"
              tone="neutral"
              trend={data.movement_trend.slice(-12).map((point) => point.stock_in - point.stock_out)}
            />
            <KpiCard
              label="Low stock"
              value={formatQuantity(data.kpis.low_stock_count)}
              caption="At or below minimum"
              icon="alert-triangle"
              tone={data.kpis.low_stock_count > 0 ? 'caution' : 'neutral'}
            />
            <KpiCard
              label="Out of stock"
              value={formatQuantity(data.kpis.out_of_stock_count)}
              caption="Nothing left on hand"
              icon="alert-circle"
              tone={data.kpis.out_of_stock_count > 0 ? 'critical' : 'neutral'}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Stock in"
              value={formatCompact(data.kpis.stock_in_units)}
              caption={`${data.kpis.stock_in_movements} receipts · last ${period} days`}
              icon="arrow-down-right"
              tone="positive"
            />
            <KpiCard
              label="Stock out"
              value={formatCompact(data.kpis.stock_out_units)}
              caption={`${data.kpis.stock_out_movements} withdrawals · last ${period} days`}
              icon="arrow-up-right"
              tone="info"
            />
            <KpiCard
              label="Active suppliers"
              value={formatQuantity(data.kpis.active_suppliers)}
              caption={`${data.kpis.adjustment_movements} adjustments recorded`}
              icon="truck"
              tone="neutral"
            />
          </div>

          {/* ---------- Attention banner ---------- */}
          {data.kpis.out_of_stock_count > 0 ? (
            <Alert
              tone="critical"
              title={`${data.kpis.out_of_stock_count} ${
                data.kpis.out_of_stock_count === 1 ? 'product has' : 'products have'
              } run out`}
              action={
                <ButtonLink href="/reports/out-of-stock" size="sm" variant="danger-subtle">
                  See what needs reordering
                </ButtonLink>
              }
            >
              No stock remains for these items, so no further withdrawals can be recorded against
              them until a receipt is entered.
            </Alert>
          ) : null}

          {/* ---------- Charts ---------- */}
          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader
                title="Stock movement"
                description={`Units received and issued over the last ${period} days`}
                actions={
                  can('reports.view') ? (
                    <ButtonLink
                      href="/reports/product-movement"
                      variant="ghost"
                      size="sm"
                      trailingIcon="arrow-right"
                    >
                      Report
                    </ButtonLink>
                  ) : null
                }
              />
              <div className="mt-5">
                <MovementTrendChart data={data.movement_trend} />
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader title="Stock health" description="Products by current status" />
              <div className="mt-6">
                <DonutChart
                  centerLabel="products"
                  centerValue={formatQuantity(data.kpis.total_products)}
                  segments={[
                    {
                      label: 'In stock',
                      value:
                        data.kpis.total_products -
                        data.kpis.low_stock_count -
                        data.kpis.out_of_stock_count,
                      color: 'var(--color-positive-500)',
                    },
                    {
                      label: 'Low stock',
                      value: data.kpis.low_stock_count,
                      color: 'var(--color-caution-500)',
                    },
                    {
                      label: 'Out of stock',
                      value: data.kpis.out_of_stock_count,
                      color: 'var(--color-critical-500)',
                    },
                  ]}
                />
              </div>
            </Card>
          </div>

          {/* ---------- Needs attention ---------- */}
          <div className="grid gap-4 lg:grid-cols-2">
            <AttentionCard
              title="Out of stock"
              description="Nothing left on hand"
              icon="alert-circle"
              products={data.out_of_stock}
              emptyMessage="Nothing has run out. Good."
              href="/reports/out-of-stock"
              tone="critical"
            />
            <AttentionCard
              title="Running low"
              description="At or below the minimum level"
              icon="alert-triangle"
              products={data.low_stock}
              emptyMessage="Every product is above its minimum."
              href="/reports/low-stock"
              tone="caution"
            />
          </div>

          {/* ---------- Recent movements ---------- */}
          <div className="grid gap-4 lg:grid-cols-2">
            <MovementCard
              title="Recent stock in"
              description="Latest receipts"
              icon="arrow-down-right"
              movements={data.recent_stock_in}
              href="/stock-in"
              emptyMessage="No receipts recorded yet."
              emptyAction={can('inventory.stock-in') ? { label: 'Record stock in', href: '/stock-in?new=1' } : undefined}
            />
            <MovementCard
              title="Recent stock out"
              description="Latest withdrawals, consumed oldest batch first"
              icon="arrow-up-right"
              movements={data.recent_stock_out}
              href="/stock-out"
              emptyMessage="No withdrawals recorded yet."
              emptyAction={can('inventory.stock-out') ? { label: 'Record stock out', href: '/stock-out?new=1' } : undefined}
            />
          </div>

          {/* ---------- Breakdown + activity ---------- */}
          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Inventory by category"
                description="Units on hand"
                actions={
                  can('categories.view') ? (
                    <ButtonLink href="/categories" variant="ghost" size="sm" trailingIcon="arrow-right">
                      All
                    </ButtonLink>
                  ) : null
                }
              />
              <div className="mt-5">
                <HorizontalBarChart
                  rows={data.category_breakdown.map((row) => ({
                    label: row.category,
                    value: row.units,
                    color: row.color,
                    caption: `${row.products} ${row.products === 1 ? 'product' : 'products'}`,
                  }))}
                  emptyMessage="Add categories to see a breakdown."
                />
              </div>
            </Card>

            <Card className="xl:col-span-3">
              <CardHeader
                title="Most movement"
                description={`Units issued in the last ${period} days`}
              />
              <div className="mt-5">
                <HorizontalBarChart
                  rows={data.top_movers.map((row) => ({
                    label: row.name,
                    value: row.units_out,
                    caption: row.sku,
                  }))}
                  emptyMessage="No withdrawals in this period."
                />
              </div>
            </Card>
          </div>

          {/* ---------- Activity + quick actions ---------- */}
          <div className="grid gap-4 xl:grid-cols-5">
            {can('audit-logs.view') ? (
              <Card className="xl:col-span-3" flush>
                <CardHeader
                  padded
                  title="Recent activity"
                  description="From your business's audit log"
                  icon="history"
                  actions={
                    <ButtonLink href="/audit-logs" variant="ghost" size="sm" trailingIcon="arrow-right">
                      Audit log
                    </ButtonLink>
                  }
                />
                {data.recent_activity.length === 0 ? (
                  <EmptyState
                    compact
                    icon="history"
                    title="No activity yet"
                    description="Actions taken in your workspace will appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border-subtle">
                    {data.recent_activity.map((entry) => (
                      <ActivityRow key={entry.id} entry={entry} />
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}

            <Card className={can('audit-logs.view') ? 'xl:col-span-2' : 'xl:col-span-5'}>
              <CardHeader title="Quick actions" description="Common next steps" icon="zap" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {quickActionsFor(can).map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-xl bg-surface-sunken/60 p-3 ring-1 ring-border-subtle ring-inset transition-all hover:bg-surface-sunken hover:ring-border-default"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-card text-brand-600 ring-1 ring-border-subtle transition-colors group-hover:bg-brand-600 group-hover:text-white dark:text-brand-300">
                      <Icon name={action.icon} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-semibold text-content-primary">
                        {action.label}
                      </span>
                      <span className="block truncate text-xs text-content-tertiary">
                        {action.description}
                      </span>
                    </span>
                    <Icon
                      name="chevron-right"
                      size={15}
                      className="shrink-0 text-content-tertiary transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';

  return 'Good evening';
}

function describeAttention(low: number, out: number): string {
  if (low === 0 && out === 0) {
    return 'Every product is above its minimum level. Nothing needs your attention.';
  }

  const parts: string[] = [];
  if (out > 0) parts.push(`${out} out of stock`);
  if (low > 0) parts.push(`${low} running low`);

  return `${parts.join(' and ')} — worth a look before the next order goes out.`;
}

function quickActionsFor(can: (...permissions: PermissionKey[]) => boolean) {
  const actions: Array<{ label: string; description: string; href: string; icon: IconName }> = [];

  if (can('inventory.stock-in')) {
    actions.push({
      label: 'Record stock in',
      description: 'Receive inventory and open a batch',
      href: '/stock-in?new=1',
      icon: 'arrow-down-right',
    });
  }

  if (can('inventory.stock-out')) {
    actions.push({
      label: 'Record stock out',
      description: 'Issue stock, oldest batch first',
      href: '/stock-out?new=1',
      icon: 'arrow-up-right',
    });
  }

  if (can('products.manage')) {
    actions.push({
      label: 'Add a product',
      description: 'Extend your catalogue',
      href: '/products?new=1',
      icon: 'package',
    });
  }

  if (can('reports.view')) {
    actions.push({
      label: 'Open reports',
      description: 'Movement, suppliers and the ledger',
      href: '/reports',
      icon: 'activity',
    });
  }

  return actions;
}

function AttentionCard({
  title,
  description,
  icon,
  products,
  emptyMessage,
  href,
  tone,
}: {
  title: string;
  description: string;
  icon: IconName;
  products: Product[];
  emptyMessage: string;
  href: string;
  tone: 'critical' | 'caution';
}) {
  return (
    <Card flush>
      <CardHeader
        padded
        title={
          <span className="flex items-center gap-2">
            {title}
            {products.length > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums',
                  tone === 'critical'
                    ? 'bg-critical-100 text-critical-700 dark:bg-critical-700/25 dark:text-critical-100'
                    : 'bg-caution-100 text-caution-700 dark:bg-caution-700/25 dark:text-caution-100',
                )}
              >
                {products.length}
              </span>
            ) : null}
          </span>
        }
        description={description}
        icon={icon}
        actions={
          products.length > 0 ? (
            <ButtonLink href={href} variant="ghost" size="sm" trailingIcon="arrow-right">
              All
            </ButtonLink>
          ) : null
        }
      />

      {products.length === 0 ? (
        <EmptyState compact icon="check-circle" title={emptyMessage} />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/products/${product.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-content-primary">
                    {product.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-content-tertiary">
                    <span className="font-mono">{product.sku}</span>
                    {product.category ? (
                      <CategoryChip name={product.category.name} color={product.category.color} />
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[0.8125rem] font-semibold tabular-nums text-content-primary">
                    {formatQuantity(product.quantity_on_hand)}
                    <span className="ml-1 text-xs font-normal text-content-tertiary">
                      / {product.minimum_stock_level} min
                    </span>
                  </p>
                  <p className="mt-0.5">
                    <StockStatusBadge
                      status={product.stock_status.value}
                      label={product.stock_status.label}
                    />
                  </p>
                </div>
                <Icon name="chevron-right" size={15} className="shrink-0 text-content-tertiary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MovementCard({
  title,
  description,
  icon,
  movements,
  href,
  emptyMessage,
  emptyAction,
}: {
  title: string;
  description: string;
  icon: IconName;
  movements: StockMovement[];
  href: string;
  emptyMessage: string;
  emptyAction?: { label: string; href: string };
}) {
  return (
    <Card flush>
      <CardHeader
        padded
        title={title}
        description={description}
        icon={icon}
        actions={
          <ButtonLink href={href} variant="ghost" size="sm" trailingIcon="arrow-right">
            All
          </ButtonLink>
        }
      />

      {movements.length === 0 ? (
        <EmptyState compact icon={icon} title={emptyMessage} action={emptyAction} />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {movements.map((movement) => (
            <li key={movement.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium text-content-primary">
                  {movement.product?.name ?? 'Unknown product'}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-content-tertiary">
                  <span className="font-mono">{movement.product?.sku}</span>
                  {movement.supplier ? <span>· {movement.supplier.name}</span> : null}
                  {movement.reference ? <span>· {movement.reference}</span> : null}
                  <span>· {formatRelative(movement.occurred_at)}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    'text-[0.8125rem] font-semibold tabular-nums',
                    movement.direction > 0
                      ? 'text-positive-700 dark:text-positive-300'
                      : 'text-content-primary',
                  )}
                >
                  {formatSigned(movement.signed_quantity)}
                  <span className="ml-1 text-xs font-normal text-content-tertiary">
                    {movement.product?.unit.abbreviation}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-content-tertiary tabular-nums">
                  balance {formatQuantity(movement.balance_after)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityRow({ entry }: { entry: AuditLogEntry }) {
  const toneFor = (category: string) => {
    switch (category) {
      case 'inventory':
        return 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300';
      case 'auth':
        return 'bg-info-50 text-info-600 dark:bg-info-700/20 dark:text-info-200';
      case 'user':
        return 'bg-ember-50 text-ember-600 dark:bg-ember-700/20 dark:text-ember-200';
      default:
        return 'bg-ink-100 text-content-secondary dark:bg-surface-raised';
    }
  };

  const iconFor = (category: string): IconName => {
    switch (category) {
      case 'inventory':
        return 'boxes';
      case 'auth':
        return 'lock';
      case 'user':
        return 'users';
      case 'price':
        return 'file-text';
      case 'supplier':
        return 'truck';
      case 'product':
        return 'package';
      default:
        return 'activity';
    }
  };

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span
        className={cn(
          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          toneFor(entry.category),
        )}
      >
        <Icon name={iconFor(entry.category)} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] leading-snug text-content-primary">{entry.description}</p>
        <p className="mt-0.5 text-xs text-content-tertiary">
          {entry.user.name ?? 'System'} · {formatRelative(entry.created_at)}
        </p>
      </div>
    </li>
  );
}
