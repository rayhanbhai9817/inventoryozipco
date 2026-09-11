'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AdjustmentModal } from '@/components/inventory/adjustment-modal';
import { MovementList } from '@/components/inventory/movement-list';
import { FilterBar } from '@/components/shared/filter-bar';
import { Badge, CategoryChip, StockStatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { DataTable, Pagination, type Column, type SortState } from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/states';
import { useAuth } from '@/lib/auth';
import { fetchBatches, fetchInventory } from '@/lib/data-source';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { ListFilters, Product, StockBatch } from '@/types/api';
import { cn } from '@/lib/utils';

type TabKey = 'position' | 'batches' | 'movements';

export default function InventoryPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<TabKey>('position');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const tabs: Array<TabItem<TabKey>> = [
    { value: 'position', label: 'Current position', icon: 'boxes' },
    { value: 'batches', label: 'Batch tracking', icon: 'layers' },
    { value: 'movements', label: 'All movements', icon: 'activity' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Where your stock stands, which batches hold it, and everything that has moved."
        actions={
          <>
            {can('inventory.adjust') ? (
              <Button variant="secondary" icon="sliders" onClick={() => setAdjustOpen(true)}>
                Adjust
              </Button>
            ) : null}
            {can('inventory.stock-in') ? (
              <ButtonLink href="/stock-in?new=1" icon="arrow-down-right">
                Stock in
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} aria-label="Inventory views" />

      {tab === 'position' ? <PositionTab key={refreshToken} /> : null}
      {tab === 'batches' ? <BatchesTab key={refreshToken} /> : null}
      {tab === 'movements' ? (
        <MovementList
          filterKeys={['search', 'dates', 'product', 'supplier', 'category', 'movementType']}
          emptyTitle="No movements recorded yet"
          emptyDescription="Record a stock in to start building your movement history."
          refreshToken={refreshToken}
        />
      ) : null}

      <AdjustmentModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onRecorded={() => setRefreshToken((token) => token + 1)}
      />
    </div>
  );
}

/* ========================================================================== */
/* Current position                                                           */
/* ========================================================================== */

function PositionTab() {
  const router = useRouter();
  const [filters, setFilters] = useState<ListFilters>({ per_page: 25, page: 1 });
  const [sort, setSort] = useState<SortState>({ key: 'quantity_on_hand', direction: 'asc' });

  const { data, loading, error, reload } = useAsync(
    () => fetchInventory({ ...filters, sort: sort.key, direction: sort.direction }),
    [filters, sort],
  );

  const columns: Array<Column<Product>> = [
    {
      key: 'product',
      header: 'Product',
      sortKey: 'name',
      primary: true,
      cell: (product) => (
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-medium text-content-primary">
            {product.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary">{product.sku}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideBelowLg: true,
      cell: (product) =>
        product.category ? (
          <CategoryChip name={product.category.name} color={product.category.color} />
        ) : (
          <span className="text-xs text-content-tertiary">—</span>
        ),
    },
    {
      key: 'onhand',
      header: 'On hand',
      sortKey: 'quantity_on_hand',
      align: 'right',
      cell: (product) => (
        <span className="text-[0.8125rem] font-semibold tabular-nums text-content-primary">
          {formatQuantity(product.quantity_on_hand)}
          <span className="ml-1 text-xs font-normal text-content-tertiary">
            {product.unit.abbreviation}
          </span>
        </span>
      ),
    },
    {
      key: 'minimum',
      header: 'Minimum',
      sortKey: 'minimum_stock_level',
      align: 'right',
      hideBelowLg: true,
      cell: (product) => (
        <span className="text-xs tabular-nums text-content-secondary">
          {product.minimum_stock_level > 0 ? formatQuantity(product.minimum_stock_level) : '—'}
        </span>
      ),
    },
    {
      key: 'coverage',
      header: 'Against minimum',
      hideBelowLg: true,
      width: 'w-40',
      cell: (product) => {
        if (product.minimum_stock_level <= 0) {
          return <span className="text-xs text-content-tertiary">No threshold</span>;
        }

        // Capped at 100% so a well-stocked product does not stretch the bar off
        // the column; the number beside it carries the real figure.
        const ratio = Math.min(
          1,
          product.quantity_on_hand / Math.max(1, product.minimum_stock_level),
        );

        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={cn(
                  'h-full rounded-full',
                  product.quantity_on_hand === 0
                    ? 'bg-critical-500'
                    : ratio >= 1
                      ? 'bg-positive-500'
                      : 'bg-caution-500',
                )}
                style={{ width: `${Math.max(ratio * 100, product.quantity_on_hand > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-content-tertiary">
              {Math.round((product.quantity_on_hand / Math.max(1, product.minimum_stock_level)) * 100)}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (product) => (
        <StockStatusBadge status={product.stock_status.value} label={product.stock_status.label} />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        enabled={['search', 'category', 'supplier', 'stockStatus', 'includeArchived']}
        searchPlaceholder="Search products…"
      />

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              rowKey={(product) => product.id}
              onRowClick={(product) => router.push(`/products/${product.id}`)}
              sort={sort}
              onSortChange={setSort}
              loading={loading && !data}
              empty={
                <EmptyState
                  icon="boxes"
                  title="Nothing in inventory yet"
                  description="Add products and record a receipt to see your position here."
                  action={{ label: 'Go to products', href: '/products' }}
                />
              }
            />

            {data && data.data.length > 0 ? (
              <Pagination
                page={data.meta.current_page}
                lastPage={data.meta.last_page}
                total={data.meta.total}
                from={data.meta.from}
                to={data.meta.to}
                perPage={data.meta.per_page}
                onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                onPerPageChange={(perPage) =>
                  setFilters((current) => ({ ...current, per_page: perPage, page: 1 }))
                }
              />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}

/* ========================================================================== */
/* Batch tracking                                                             */
/* ========================================================================== */

function BatchesTab() {
  const [filters, setFilters] = useState<ListFilters>({ per_page: 25, page: 1 });

  const { data, loading, error, reload } = useAsync(() => fetchBatches(filters), [filters]);

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
          <p className="mt-0.5 truncate text-xs text-content-tertiary">
            {batch.product?.name ?? 'Unknown product'}
          </p>
        </div>
      ),
    },
    {
      key: 'received',
      header: 'Received',
      cell: (batch) => (
        <span className="text-[0.8125rem] whitespace-nowrap text-content-secondary">
          {formatDate(batch.received_at)}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      hideBelowLg: true,
      cell: (batch) => (
        <span className="text-[0.8125rem] text-content-secondary">
          {batch.supplier?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'quantities',
      header: 'Remaining',
      align: 'right',
      cell: (batch) => (
        <div className="min-w-[6rem]">
          <p className="text-[0.8125rem] font-semibold tabular-nums text-content-primary">
            {formatQuantity(batch.quantity_remaining)}
            <span className="ml-1 text-xs font-normal text-content-tertiary">
              / {formatQuantity(batch.quantity_received)}
            </span>
          </p>
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
    <div className="space-y-5">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        enabled={['product', 'supplier', 'includeDepleted']}
      />

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              rowKey={(batch) => batch.id}
              loading={loading && !data}
              dense
              empty={
                <EmptyState
                  icon="layers"
                  title="No batches yet"
                  description="Batches are created when you record a receipt. They are the unit FIFO consumes."
                  action={{ label: 'Record stock in', href: '/stock-in?new=1' }}
                />
              }
            />

            {data && data.data.length > 0 ? (
              <Pagination
                page={data.meta.current_page}
                lastPage={data.meta.last_page}
                total={data.meta.total}
                from={data.meta.from}
                to={data.meta.to}
                perPage={data.meta.per_page}
                onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                onPerPageChange={(perPage) =>
                  setFilters((current) => ({ ...current, per_page: perPage, page: 1 }))
                }
              />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
