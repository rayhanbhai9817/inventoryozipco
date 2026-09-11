'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { FilterBar, type FilterKey } from '@/components/shared/filter-bar';
import { MovementTypeBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { DataTable, Pagination, type Column, type SortState } from '@/components/ui/table';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatDateTime, formatQuantity, formatRelative, formatSigned } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { fetchMovements } from '@/lib/data-source';
import type { ListFilters, MovementTypeKey, StockMovement } from '@/types/api';
import { cn } from '@/lib/utils';

/**
 * The movement table, shared by Stock IN, Stock OUT and the combined inventory
 * movement view.
 *
 * One component rather than three near-identical pages: the differences are a
 * type filter, the column set and the empty state, all of which are props.
 */
export interface MovementListProps {
  /** Restrict to one movement type. Omit for all types. */
  type?: MovementTypeKey;
  /** Shows the allocation column — only meaningful for outbound movements. */
  showAllocations?: boolean;
  filterKeys?: FilterKey[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: { label: string; onClick: () => void; icon?: 'plus' | 'arrow-down-right' | 'arrow-up-right' };
  /** Extra controls beside the filters, e.g. an export button. */
  actions?: ReactNode;
  /** Bumped by the parent after recording a movement, to force a refetch. */
  refreshToken?: number;
}

export function MovementList({
  type,
  showAllocations = false,
  filterKeys = ['search', 'dates', 'product', 'supplier', 'category'],
  emptyTitle,
  emptyDescription,
  emptyAction,
  actions,
  refreshToken = 0,
}: MovementListProps) {
  const [filters, setFilters] = useState<ListFilters>({ per_page: 25, page: 1 });
  const [sort, setSort] = useState<SortState>({ key: 'occurred_at', direction: 'desc' });

  const { data, loading, error, reload } = useAsync(
    () => fetchMovements({ ...filters, sort: sort.key, direction: sort.direction }, type),
    [filters, sort, type, refreshToken],
  );

  const totals = data?.meta.totals;

  const columns: Array<Column<StockMovement>> = [
    {
      key: 'when',
      header: 'When',
      sortKey: 'occurred_at',
      primary: true,
      cell: (movement) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium whitespace-nowrap text-content-primary">
            {formatDateTime(movement.occurred_at)}
          </p>
          <p className="mt-0.5 text-xs text-content-tertiary">
            {formatRelative(movement.occurred_at)}
          </p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      cell: (movement) =>
        movement.product ? (
          <Link
            href={`/products/${movement.product.id}`}
            className="group min-w-0 rounded"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="truncate text-[0.8125rem] font-medium text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-300">
              {movement.product.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary">
              {movement.product.sku}
            </p>
          </Link>
        ) : (
          <span className="text-xs text-content-tertiary">Unknown</span>
        ),
    },
    ...(type
      ? []
      : ([
          {
            key: 'type',
            header: 'Type',
            cell: (movement: StockMovement) => (
              <MovementTypeBadge type={movement.type.value} label={movement.type.label} />
            ),
          },
        ] as Array<Column<StockMovement>>)),
    {
      key: 'supplier',
      header: 'Supplier',
      hideBelowLg: true,
      cell: (movement) =>
        movement.supplier ? (
          <Link
            href={`/suppliers/${movement.supplier.id}`}
            onClick={(event) => event.stopPropagation()}
            className="rounded text-[0.8125rem] text-content-secondary transition-colors hover:text-brand-600 hover:underline dark:hover:text-brand-300"
          >
            {movement.supplier.name}
          </Link>
        ) : (
          <span className="text-xs text-content-tertiary">—</span>
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
    ...(showAllocations
      ? ([
          {
            key: 'allocations',
            header: 'Batches consumed',
            hideBelowLg: true,
            cell: (movement: StockMovement) => {
              if (!movement.allocations || movement.allocations.length === 0) {
                return <span className="text-xs text-content-tertiary">—</span>;
              }

              return (
                <div className="space-y-0.5">
                  {movement.allocations.slice(0, 2).map((allocation) => (
                    <p
                      key={allocation.batch_id}
                      className="font-mono text-xs whitespace-nowrap text-content-tertiary"
                    >
                      {allocation.batch_number}
                      <span className="ml-1.5 font-sans font-medium tabular-nums text-content-secondary">
                        −{allocation.quantity}
                      </span>
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
        ] as Array<Column<StockMovement>>)
      : []),
    ...(!showAllocations && type === 'stock_in'
      ? ([
          {
            key: 'batch',
            header: 'Batch',
            hideBelowLg: true,
            cell: (movement: StockMovement) => (
              <span className="font-mono text-xs whitespace-nowrap text-content-tertiary">
                {movement.batch?.batch_number ?? '—'}
              </span>
            ),
          },
        ] as Array<Column<StockMovement>>)
      : []),
    {
      key: 'quantity',
      header: 'Quantity',
      sortKey: 'quantity',
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
          <span className="ml-1 text-xs font-normal text-content-tertiary">
            {movement.product?.unit.abbreviation}
          </span>
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      sortKey: 'balance_after',
      align: 'right',
      cell: (movement) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(movement.balance_after)}
        </span>
      ),
    },
    {
      key: 'by',
      header: 'By',
      align: 'right',
      hideBelowLg: true,
      cell: (movement) => (
        <span className="text-xs whitespace-nowrap text-content-tertiary">
          {movement.created_by?.name ?? '—'}
        </span>
      ),
    },
  ];

  const hasFilters = Boolean(
    filters.search || filters.product_id || filters.supplier_id || filters.category_id || filters.date_from,
  );

  return (
    <div className="space-y-5">
      {totals ? (
        <div className="grid grid-cols-3 gap-3">
          <TotalTile label="Movements" value={formatQuantity(totals.movements)} icon="activity" />
          <TotalTile label="Units moved" value={formatQuantity(totals.units)} icon="boxes" />
          <TotalTile label="Products touched" value={formatQuantity(totals.products)} icon="package" />
        </div>
      ) : null}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        enabled={filterKeys}
        searchPlaceholder="Search by reference, note, product or SKU…"
        actions={actions}
      />

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              rowKey={(movement) => movement.id}
              sort={sort}
              onSortChange={setSort}
              loading={loading && !data}
              dense
              empty={
                hasFilters ? (
                  <EmptyState
                    icon="search"
                    title="No movements match these filters"
                    description="Try widening the date range or clearing the filters."
                    action={{
                      label: 'Clear filters',
                      onClick: () => setFilters({ per_page: filters.per_page, page: 1 }),
                    }}
                  />
                ) : (
                  <EmptyState
                    icon="activity"
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                )
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

function TotalTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: 'activity' | 'boxes' | 'package';
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-card p-3.5 ring-1 ring-border-subtle">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-content-secondary">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-content-tertiary">{label}</p>
        <p className="font-display text-lg leading-tight font-semibold tabular-nums text-content-primary">
          {value}
        </p>
      </div>
    </div>
  );
}
