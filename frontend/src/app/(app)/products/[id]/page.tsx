'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProductFormModal } from '@/components/products/product-form-modal';
import {
  Badge,
  CategoryChip,
  MovementTypeBadge,
  StockStatusBadge,
} from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, KpiCard, StatList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import {
  Alert,
  CardSkeleton,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/components/ui/states';
import { useAuth } from '@/lib/auth';
import {
  fetchPriceHistory,
  fetchProduct,
  fetchProductBatches,
  fetchProductLedger,
  fetchProductMovements,
} from '@/lib/data-source';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  formatQuantity,
  formatRelative,
  formatSigned,
} from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type {
  LedgerEntry,
  ProductPriceHistoryEntry,
  StockBatch,
  StockMovement,
} from '@/types/api';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'batches' | 'movements' | 'ledger' | 'pricing';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const productId = Number(params.id);

  const [tab, setTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);

  const product = useAsync(() => fetchProduct(productId), [productId], {
    enabled: Number.isFinite(productId),
  });

  if (product.loading && !product.data) {
    return <LoadingState label="Loading product…" />;
  }

  if (product.error || !product.data) {
    return (
      <Card>
        <ErrorState
          title="We could not load this product"
          message={product.error ?? 'It may have been removed, or it belongs to another business.'}
          onRetry={product.reload}
        />
        <div className="flex justify-center pb-6">
          <ButtonLink href="/products" variant="secondary" icon="arrow-left">
            Back to products
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const item = product.data;

  const tabs: Array<TabItem<TabKey>> = [
    { value: 'overview', label: 'Overview', icon: 'info' },
    { value: 'batches', label: 'Batches', icon: 'layers', count: item.batch_count },
    { value: 'movements', label: 'Movements', icon: 'activity', count: item.movement_count },
    { value: 'ledger', label: 'Ledger', icon: 'file-text' },
    ...(can('prices.view')
      ? ([{ value: 'pricing' as const, label: 'Price reference', icon: 'tag' as const }] as const)
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
            <Link
              href="/products"
              className="rounded text-content-tertiary transition-colors hover:text-content-primary"
            >
              Products
            </Link>
            <Icon name="chevron-right" size={12} className="text-content-tertiary" />
            <span className="truncate font-medium text-content-secondary">{item.sku}</span>
          </nav>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {item.name}
            {item.is_archived ? <Badge tone="neutral">Archived</Badge> : null}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-content-tertiary">{item.sku}</span>
            {item.barcode ? (
              <span className="font-mono text-xs text-content-tertiary">· {item.barcode}</span>
            ) : null}
            {item.category ? (
              <CategoryChip name={item.category.name} color={item.category.color} />
            ) : null}
            <StockStatusBadge status={item.stock_status.value} label={item.stock_status.label} />
          </span>
        }
        actions={
          <>
            {can('inventory.stock-in') && !item.is_archived ? (
              <ButtonLink
                href={`/stock-in?new=1&product=${item.id}`}
                variant="secondary"
                size="sm"
                icon="arrow-down-right"
              >
                Stock in
              </ButtonLink>
            ) : null}
            {can('inventory.stock-out') && !item.is_archived && item.quantity_on_hand > 0 ? (
              <ButtonLink
                href={`/stock-out?new=1&product=${item.id}`}
                variant="secondary"
                size="sm"
                icon="arrow-up-right"
              >
                Stock out
              </ButtonLink>
            ) : null}
            {can('products.manage') ? (
              <Button size="sm" icon="edit" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            ) : null}
          </>
        }
      />

      {item.is_archived ? (
        <Alert tone="caution" title="This product is archived">
          It is hidden from pickers and cannot take new stock movements. Its history below remains
          complete and reportable.
        </Alert>
      ) : null}

      {/* ---------- Position ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="On hand"
          value={
            <>
              {formatQuantity(item.quantity_on_hand)}
              <span className="ml-1.5 text-base font-normal text-content-tertiary">
                {item.unit.abbreviation}
              </span>
            </>
          }
          caption="Sum of open batches"
          icon="boxes"
          tone={
            item.stock_status.value === 'out_of_stock'
              ? 'critical'
              : item.stock_status.value === 'low_stock'
                ? 'caution'
                : 'positive'
          }
        />
        <KpiCard
          label="Minimum level"
          value={formatQuantity(item.minimum_stock_level)}
          caption={
            item.minimum_stock_level > 0
              ? `Alerts at or below ${item.minimum_stock_level}`
              : 'No alert threshold set'
          }
          icon="alert-triangle"
          tone="neutral"
        />
        <KpiCard
          label="Open batches"
          value={formatQuantity(item.open_batches?.length ?? 0)}
          caption={`${item.batch_count ?? 0} received in total`}
          icon="layers"
          tone="brand"
        />
        <KpiCard
          label="Reference price"
          value={
            item.price ? formatCurrency(item.price.reference_price, item.price.currency) : '—'
          }
          caption={
            item.price
              ? `Effective ${formatDate(item.price.effective_from)}`
              : 'Not in the price catalogue'
          }
          icon="tag"
          tone="neutral"
        />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} aria-label="Product sections" />

      {tab === 'overview' ? <OverviewTab productId={item.id} /> : null}
      {tab === 'batches' ? <BatchesTab productId={item.id} unit={item.unit.abbreviation} /> : null}
      {tab === 'movements' ? <MovementsTab productId={item.id} /> : null}
      {tab === 'ledger' ? <LedgerTab productId={item.id} /> : null}
      {tab === 'pricing' ? <PricingTab productId={item.id} /> : null}

      <ProductFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        product={item}
        onSaved={() => {
          product.reload();
          router.refresh();
        }}
      />
    </div>
  );
}

/* ========================================================================== */
/* Overview                                                                   */
/* ========================================================================== */

function OverviewTab({ productId }: { productId: number }) {
  const product = useAsync(() => fetchProduct(productId), [productId]);
  const item = product.data;

  if (!item) return <CardSkeleton lines={6} />;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Product information" icon="info" />
        <div className="mt-5 space-y-5">
          <StatList
            columns={2}
            items={[
              { label: 'SKU', value: <span className="font-mono">{item.sku}</span> },
              {
                label: 'Barcode',
                value: item.barcode ? <span className="font-mono">{item.barcode}</span> : '—',
              },
              { label: 'Category', value: item.category?.name ?? 'Uncategorised' },
              { label: 'Unit of measure', value: `${item.unit.label} (${item.unit.abbreviation})` },
              {
                label: 'Reorder quantity',
                value: item.reorder_quantity ? formatQuantity(item.reorder_quantity) : '—',
              },
              { label: 'Added', value: formatDate(item.created_at) },
            ]}
          />

          {item.description ? (
            <div className="border-t border-border-subtle pt-5">
              <p className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
                Description
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
                {item.description}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Suppliers"
          description={`${item.suppliers?.length ?? 0} linked`}
          icon="truck"
        />
        {!item.suppliers || item.suppliers.length === 0 ? (
          <EmptyState
            compact
            icon="truck"
            title="No suppliers linked"
            description="Link a supplier so reordering and supplier reports are complete."
            action={{ label: 'Manage suppliers', href: '/suppliers' }}
          />
        ) : (
          <ul className="mt-4 space-y-2">
            {item.suppliers.map((supplier) => (
              <li key={supplier.id}>
                <Link
                  href={`/suppliers/${supplier.id}`}
                  className="flex items-center gap-3 rounded-xl bg-surface-sunken/60 p-3 ring-1 ring-border-subtle ring-inset transition-colors hover:bg-surface-sunken"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-card text-content-secondary ring-1 ring-border-subtle">
                    <Icon name="truck" size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[0.8125rem] font-medium text-content-primary">
                        {supplier.name}
                      </span>
                      {supplier.link?.is_preferred ? (
                        <Badge tone="brand" size="sm">
                          Preferred
                        </Badge>
                      ) : null}
                    </span>
                    {supplier.link?.lead_time_days ? (
                      <span className="mt-0.5 block text-xs text-content-tertiary">
                        {supplier.link.lead_time_days} day lead time
                        {supplier.link.supplier_sku ? ` · ${supplier.link.supplier_sku}` : ''}
                      </span>
                    ) : null}
                  </span>
                  <Icon name="chevron-right" size={15} className="shrink-0 text-content-tertiary" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ========================================================================== */
/* Batches                                                                    */
/* ========================================================================== */

function BatchesTab({ productId, unit }: { productId: number; unit: string }) {
  const [openOnly, setOpenOnly] = useState(true);
  const { data, loading, error, reload } = useAsync(
    () => fetchProductBatches(productId, openOnly),
    [productId, openOnly],
  );

  const columns: Array<Column<StockBatch>> = [
    {
      key: 'batch',
      header: 'Batch',
      primary: true,
      cell: (batch) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-[0.8125rem] font-medium text-content-primary">
            {batch.batch_number}
          </p>
          <p className="mt-0.5 text-xs text-content-tertiary">
            Received {formatDate(batch.received_at)}
            {batch.reference ? ` · ${batch.reference}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      hideBelowLg: true,
      cell: (batch) =>
        batch.supplier ? (
          <Link
            href={`/suppliers/${batch.supplier.id}`}
            className="rounded text-[0.8125rem] text-content-secondary transition-colors hover:text-brand-600 hover:underline dark:hover:text-brand-300"
          >
            {batch.supplier.name}
          </Link>
        ) : (
          <span className="text-xs text-content-tertiary">—</span>
        ),
    },
    {
      key: 'received',
      header: 'Received',
      align: 'right',
      cell: (batch) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(batch.quantity_received)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'Remaining',
      align: 'right',
      cell: (batch) => (
        <div className="min-w-[5rem]">
          <span
            className={cn(
              'text-[0.8125rem] font-semibold tabular-nums',
              batch.is_depleted ? 'text-content-tertiary' : 'text-content-primary',
            )}
          >
            {formatQuantity(batch.quantity_remaining)}
            <span className="ml-1 text-xs font-normal text-content-tertiary">{unit}</span>
          </span>
          {/* A consumption bar makes FIFO position readable at a glance. */}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={cn(
                'h-full rounded-full',
                batch.is_depleted ? 'bg-ink-300 dark:bg-ink-700' : 'bg-brand-500',
              )}
              style={{
                width: `${(batch.quantity_remaining / Math.max(1, batch.quantity_received)) * 100}%`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Unit cost',
      align: 'right',
      hideBelowLg: true,
      mobileLabel: 'Unit cost',
      cell: (batch) => (
        <span className="text-xs tabular-nums text-content-tertiary">
          {batch.unit_cost ? formatCurrency(batch.unit_cost, batch.currency ?? 'USD') : '—'}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'State',
      align: 'right',
      cell: (batch) =>
        batch.is_depleted ? (
          <Badge tone="neutral">Depleted</Badge>
        ) : batch.quantity_remaining < batch.quantity_received ? (
          <Badge tone="info">Partly used</Badge>
        ) : (
          <Badge tone="positive">Untouched</Badge>
        ),
    },
  ];

  return (
    <Card flush>
      <CardHeader
        padded
        title="Stock batches"
        description="Oldest first — this is the order stock out consumes them in."
        icon="layers"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={openOnly ? 'eye' : 'eye-off'}
            onClick={() => setOpenOnly((current) => !current)}
          >
            {openOnly ? 'Show depleted' : 'Open only'}
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} compact />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(batch) => batch.id}
          loading={loading && !data}
          empty={
            <EmptyState
              compact
              icon="layers"
              title={openOnly ? 'No open batches' : 'No batches yet'}
              description={
                openOnly
                  ? 'Every batch for this product has been fully consumed.'
                  : 'Record a stock in to open the first batch for this product.'
              }
            />
          }
        />
      )}
    </Card>
  );
}

/* ========================================================================== */
/* Movements                                                                  */
/* ========================================================================== */

function MovementsTab({ productId }: { productId: number }) {
  const { data, loading, error, reload } = useAsync(
    () => fetchProductMovements(productId, { per_page: 25 }),
    [productId],
  );

  const columns: Array<Column<StockMovement>> = [
    {
      key: 'when',
      header: 'When',
      primary: true,
      cell: (movement) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-content-primary">
            {formatDateTime(movement.occurred_at)}
          </p>
          <p className="mt-0.5 text-xs text-content-tertiary">
            {formatRelative(movement.occurred_at)}
            {movement.created_by ? ` · ${movement.created_by.name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (movement) => (
        <MovementTypeBadge type={movement.type.value} label={movement.type.label} />
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      hideBelowLg: true,
      cell: (movement) => (
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] text-content-secondary">
            {movement.reference ?? '—'}
          </p>
          {movement.reason ? (
            <p className="mt-0.5 truncate text-xs text-content-tertiary">{movement.reason}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'batches',
      header: 'Batches',
      hideBelowLg: true,
      cell: (movement) => {
        // Inbound movements name their new batch; outbound ones list what FIFO
        // consumed, which is the interesting part.
        if (movement.batch) {
          return (
            <span className="font-mono text-xs text-content-tertiary">
              {movement.batch.batch_number}
            </span>
          );
        }

        if (!movement.allocations || movement.allocations.length === 0) {
          return <span className="text-xs text-content-tertiary">—</span>;
        }

        return (
          <div className="space-y-0.5">
            {movement.allocations.slice(0, 2).map((allocation) => (
              <p key={allocation.batch_id} className="font-mono text-xs text-content-tertiary">
                {allocation.batch_number}
                <span className="ml-1.5 tabular-nums">−{allocation.quantity}</span>
              </p>
            ))}
            {movement.allocations.length > 2 ? (
              <p className="text-xs text-content-tertiary">
                +{movement.allocations.length - 2} more
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      cell: (movement) => (
        <span
          className={cn(
            'text-[0.8125rem] font-semibold tabular-nums',
            movement.direction > 0
              ? 'text-positive-700 dark:text-positive-300'
              : movement.type.value === 'adjustment'
                ? 'text-caution-700 dark:text-caution-300'
                : 'text-info-700 dark:text-info-300',
          )}
        >
          {formatSigned(movement.signed_quantity)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (movement) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(movement.balance_after)}
        </span>
      ),
    },
  ];

  return (
    <Card flush>
      <CardHeader
        padded
        title="Movement history"
        description="Every receipt, withdrawal and adjustment for this product."
        icon="activity"
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} compact />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(movement) => movement.id}
          loading={loading && !data}
          dense
          empty={
            <EmptyState
              compact
              icon="activity"
              title="No movements recorded"
              description="This product has not been received or issued yet."
            />
          }
        />
      )}
    </Card>
  );
}

/* ========================================================================== */
/* Ledger                                                                     */
/* ========================================================================== */

function LedgerTab({ productId }: { productId: number }) {
  const { data, loading, error, reload } = useAsync(
    () => fetchProductLedger(productId, { per_page: 50 }),
    [productId],
  );

  const columns: Array<Column<LedgerEntry>> = [
    {
      key: 'when',
      header: 'When',
      primary: true,
      cell: (entry) => (
        <span className="text-[0.8125rem] whitespace-nowrap text-content-primary">
          {formatDateTime(entry.occurred_at)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (entry) => <MovementTypeBadge type={entry.type.value} label={entry.type.label} />,
    },
    {
      key: 'batch',
      header: 'Batch',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="font-mono text-xs text-content-tertiary">
          {entry.batch?.batch_number ?? '—'}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs text-content-secondary">{entry.reference ?? '—'}</span>
      ),
    },
    {
      key: 'user',
      header: 'By',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs text-content-secondary">{entry.user?.name ?? 'System'}</span>
      ),
    },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      cell: (entry) => (
        <span
          className={cn(
            'text-[0.8125rem] font-semibold tabular-nums',
            entry.quantity_change > 0
              ? 'text-positive-700 dark:text-positive-300'
              : 'text-content-primary',
          )}
        >
          {formatSigned(entry.quantity_change)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (entry) => (
        <span className="text-[0.8125rem] font-medium tabular-nums text-content-primary">
          {formatQuantity(entry.balance_after)}
        </span>
      ),
    },
  ];

  return (
    <Card flush>
      <CardHeader
        padded
        title="Inventory ledger"
        description="Append-only. One line per batch-level effect, with the running balance."
        icon="file-text"
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-content-tertiary">
            <Icon name="lock" size={13} />
            Immutable
          </span>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} compact />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(entry) => entry.id}
          loading={loading && !data}
          dense
          empty={
            <EmptyState
              compact
              icon="file-text"
              title="The ledger is empty for this product"
              description="Ledger lines appear as soon as stock moves."
            />
          }
        />
      )}
    </Card>
  );
}

/* ========================================================================== */
/* Pricing                                                                    */
/* ========================================================================== */

function PricingTab({ productId }: { productId: number }) {
  const { data, loading, error, reload } = useAsync(
    () => fetchPriceHistory(productId),
    [productId],
  );

  const columns: Array<Column<ProductPriceHistoryEntry>> = [
    {
      key: 'effective',
      header: 'Effective',
      primary: true,
      cell: (entry) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-content-primary">
            {formatDate(entry.effective_from)}
            {entry.is_current ? (
              <Badge tone="positive" size="sm" className="ml-2">
                Current
              </Badge>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-content-tertiary">
            {entry.effective_to ? `Until ${formatDate(entry.effective_to)}` : 'Still in effect'}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Reference price',
      align: 'right',
      cell: (entry) => (
        <span className="text-[0.8125rem] font-semibold tabular-nums text-content-primary">
          {formatCurrency(entry.reference_price, entry.currency)}
        </span>
      ),
    },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      cell: (entry) =>
        entry.change_percentage === null ? (
          <span className="text-xs text-content-tertiary">First price</span>
        ) : (
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              entry.change_percentage > 0
                ? 'text-critical-700 dark:text-critical-300'
                : 'text-positive-700 dark:text-positive-300',
            )}
          >
            {formatPercent(entry.change_percentage)}
          </span>
        ),
    },
    {
      key: 'source',
      header: 'Source',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs text-content-secondary">{entry.source ?? '—'}</span>
      ),
    },
    {
      key: 'recorded',
      header: 'Recorded by',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs text-content-secondary">{entry.recorded_by?.name ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Reference data only" icon="info">
        Prices here are for reference and quoting. They never participate in quantity arithmetic,
        FIFO consumption or ledger balances — changing a price cannot change your stock.
      </Alert>

      <Card flush>
        <CardHeader
          padded
          title="Price reference history"
          description="Every price that has been in effect, and the window it applied for."
          icon="tag"
        />

        {error ? (
          <ErrorState message={error} onRetry={reload} compact />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(entry) => entry.id}
            loading={loading && !data}
            empty={
              <EmptyState
                compact
                icon="tag"
                title="No reference price recorded"
                description="Add this product to the price catalogue to start tracking its reference price."
                action={{ label: 'Open price catalogue', href: '/price-catalog' }}
              />
            }
          />
        )}
      </Card>
    </div>
  );
}
