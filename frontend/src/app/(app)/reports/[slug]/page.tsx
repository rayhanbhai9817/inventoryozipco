'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { FilterBar, type FilterKey } from '@/components/shared/filter-bar';
import {
  ActiveBadge,
  Badge,
  CategoryChip,
  MovementTypeBadge,
  StockStatusBadge,
} from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { exportReport, fetchReport } from '@/lib/data-source';
import { REPORTS } from '@/lib/navigation';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  formatQuantity,
  formatSigned,
} from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type {
  LedgerEntry,
  ListFilters,
  Product,
  ProductPriceHistoryEntry,
  StockMovement,
  Supplier,
} from '@/types/api';
import { cn } from '@/lib/utils';

/**
 * A single report.
 *
 * All nine reports share this page: the slug selects a column set, a filter set
 * and an empty state from the table below. That keeps them consistent and means
 * adding a tenth report is a row in a map rather than a new screen.
 */

type ReportRow = Product | StockMovement | LedgerEntry | Supplier | ProductPriceHistoryEntry;

interface ReportConfig {
  filters: FilterKey[];
  columns: Array<Column<never>>;
  emptyTitle: string;
  emptyDescription: string;
  defaultPerPage?: number;
  dense?: boolean;
}

export default function ReportPage() {
  const params = useParams<{ slug: string }>();
  const toast = useToast();
  const { can } = useAuth();

  const definition = REPORTS.find((report) => report.slug === params.slug);

  const [filters, setFilters] = useState<ListFilters>({ per_page: 25, page: 1 });
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => fetchReport(params.slug, filters),
    [params.slug, filters],
    { enabled: Boolean(definition) },
  );

  const config = useMemo(() => (definition ? reportConfig(params.slug) : null), [definition, params.slug]);

  if (!definition || !config) {
    notFound();
  }

  async function handleExport() {
    setExporting(true);

    try {
      await exportReport(params.slug, filters);
      toast.success('Export ready', 'Your CSV has been downloaded.');
    } catch {
      toast.error('Export failed', 'Please try again in a moment.');
    } finally {
      setExporting(false);
    }
  }

  const totals = data?.meta.totals;
  const hasFilters = Object.keys(filters).some(
    (key) => !['per_page', 'page'].includes(key) && filters[key as keyof ListFilters],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
            <Link
              href="/reports"
              className="rounded text-content-tertiary transition-colors hover:text-content-primary"
            >
              Reports
            </Link>
            <Icon name="chevron-right" size={12} className="text-content-tertiary" />
            <span className="font-medium text-content-secondary">{definition.label}</span>
          </nav>
        }
        title={definition.label}
        description={definition.description}
        actions={
          <>
            <ButtonLink href="/reports" variant="ghost" size="sm" icon="arrow-left">
              All reports
            </ButtonLink>
            {can('reports.export') ? (
              <Button icon="download" onClick={handleExport} loading={exporting}>
                Export CSV
              </Button>
            ) : null}
          </>
        }
      />

      {totals ? (
        <div className="flex flex-wrap gap-3">
          {Object.entries(totals).map(([key, value]) => (
            <div
              key={key}
              className="min-w-[9rem] flex-1 rounded-xl bg-surface-card p-3.5 ring-1 ring-border-subtle"
            >
              <p className="text-xs font-medium text-content-tertiary capitalize">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="mt-1 font-display text-xl leading-none font-semibold tabular-nums text-content-primary">
                {formatQuantity(value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        enabled={config.filters}
        searchPlaceholder="Search this report…"
      />

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={config.columns as Array<Column<ReportRow>>}
              rows={(data?.data ?? []) as ReportRow[]}
              rowKey={(row) => (row as { id: number }).id}
              loading={loading && !data}
              dense={config.dense}
              empty={
                hasFilters ? (
                  <EmptyState
                    icon="search"
                    title="No rows match these filters"
                    description="Try widening the date range or clearing the filters."
                    action={{
                      label: 'Clear filters',
                      onClick: () => setFilters({ per_page: filters.per_page, page: 1 }),
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={definition.icon}
                    title={config.emptyTitle}
                    description={config.emptyDescription}
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

/* ========================================================================== */
/* Column sets                                                                */
/* ========================================================================== */

function reportConfig(slug: string): ReportConfig {
  switch (slug) {
    case 'stock-in':
    case 'stock-out':
    case 'product-movement':
      return {
        filters: ['search', 'dates', 'product', 'supplier', 'category', ...(slug === 'product-movement' ? (['movementType'] as FilterKey[]) : [])],
        dense: true,
        columns: movementColumns(slug) as Array<Column<never>>,
        emptyTitle: 'No movements in this report',
        emptyDescription: 'Record a stock movement to populate it.',
      };

    case 'low-stock':
      return {
        filters: ['search', 'category'],
        columns: productColumns(true) as Array<Column<never>>,
        emptyTitle: 'Nothing is running low',
        emptyDescription: 'Every product is above its minimum stock level.',
      };

    case 'out-of-stock':
      return {
        filters: ['search', 'category'],
        columns: productColumns(true) as Array<Column<never>>,
        emptyTitle: 'Nothing has run out',
        emptyDescription: 'Every product has stock on hand.',
      };

    case 'suppliers':
      return {
        filters: ['search', 'dates', 'includeInactive'],
        columns: supplierColumns() as Array<Column<never>>,
        emptyTitle: 'No suppliers to report on',
        emptyDescription: 'Add suppliers and record receipts against them.',
      };

    case 'ledger':
      return {
        filters: ['dates', 'product', 'supplier', 'movementType'],
        dense: true,
        defaultPerPage: 50,
        columns: ledgerColumns() as Array<Column<never>>,
        emptyTitle: 'The ledger is empty',
        emptyDescription: 'Ledger lines are written automatically as stock moves.',
      };

    case 'price-history':
      return {
        filters: ['search', 'dates', 'product', 'category'],
        columns: priceHistoryColumns() as Array<Column<never>>,
        emptyTitle: 'No price history yet',
        emptyDescription: 'Record reference prices in the price catalogue to build a history.',
      };

    case 'inventory-summary':
    default:
      return {
        filters: ['search', 'category', 'supplier', 'stockStatus', 'includeArchived'],
        columns: productColumns(false) as Array<Column<never>>,
        emptyTitle: 'Your catalogue is empty',
        emptyDescription: 'Add products to see them summarised here.',
      };
  }
}

function productColumns(emphasiseShortfall: boolean): Array<Column<Product>> {
  return [
    {
      key: 'product',
      header: 'Product',
      sortKey: 'name',
      primary: true,
      cell: (product) => (
        <Link href={`/products/${product.id}`} className="group min-w-0 rounded">
          <p className="truncate text-[0.8125rem] font-medium text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-300">
            {product.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary">{product.sku}</p>
        </Link>
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
      key: 'suppliers',
      header: 'Suppliers',
      hideBelowLg: true,
      cell: (product) => {
        const names = product.suppliers?.map((supplier) => supplier.name) ?? [];

        return names.length > 0 ? (
          <span className="text-xs text-content-secondary">
            {names[0]}
            {names.length > 1 ? (
              <span className="ml-1 text-content-tertiary">+{names.length - 1}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-caution-700 dark:text-caution-300">None</span>
        );
      },
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
      cell: (product) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {product.minimum_stock_level > 0 ? formatQuantity(product.minimum_stock_level) : '—'}
        </span>
      ),
    },
    ...(emphasiseShortfall
      ? ([
          {
            key: 'shortfall',
            header: 'Shortfall',
            align: 'right' as const,
            cell: (product: Product) => {
              // How much to order to get back to the minimum — the number the
              // person reading a low-stock report actually needs.
              const shortfall = Math.max(
                0,
                product.minimum_stock_level - product.quantity_on_hand,
              );

              return (
                <span className="text-[0.8125rem] font-semibold tabular-nums text-critical-700 dark:text-critical-300">
                  {shortfall > 0 ? `−${formatQuantity(shortfall)}` : '—'}
                </span>
              );
            },
          },
          {
            key: 'reorder',
            header: 'Reorder qty',
            align: 'right' as const,
            hideBelowLg: true,
            cell: (product: Product) => (
              <span className="text-xs tabular-nums text-content-secondary">
                {product.reorder_quantity ? formatQuantity(product.reorder_quantity) : '—'}
              </span>
            ),
          },
        ] as Array<Column<Product>>)
      : ([
          {
            key: 'price',
            header: 'Reference price',
            align: 'right' as const,
            hideBelowLg: true,
            cell: (product: Product) => (
              <span className="text-xs tabular-nums text-content-secondary">
                {product.price
                  ? formatCurrency(product.price.reference_price, product.price.currency)
                  : '—'}
              </span>
            ),
          },
        ] as Array<Column<Product>>)),
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (product) => (
        <StockStatusBadge status={product.stock_status.value} label={product.stock_status.label} />
      ),
    },
  ];
}

function movementColumns(slug: string): Array<Column<StockMovement>> {
  return [
    {
      key: 'when',
      header: 'When',
      sortKey: 'occurred_at',
      primary: true,
      cell: (movement) => (
        <span className="text-[0.8125rem] whitespace-nowrap text-content-primary">
          {formatDateTime(movement.occurred_at)}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      cell: (movement) =>
        movement.product ? (
          <Link href={`/products/${movement.product.id}`} className="group min-w-0 rounded">
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
    ...(slug === 'product-movement'
      ? ([
          {
            key: 'type',
            header: 'Type',
            cell: (movement: StockMovement) => (
              <MovementTypeBadge type={movement.type.value} label={movement.type.label} />
            ),
          },
        ] as Array<Column<StockMovement>>)
      : []),
    ...(slug !== 'stock-out'
      ? ([
          {
            key: 'supplier',
            header: 'Supplier',
            hideBelowLg: true,
            cell: (movement: StockMovement) => (
              <span className="text-xs text-content-secondary">
                {movement.supplier?.name ?? '—'}
              </span>
            ),
          },
        ] as Array<Column<StockMovement>>)
      : []),
    {
      key: 'reference',
      header: 'Reference',
      hideBelowLg: true,
      cell: (movement) => (
        <span className="text-xs text-content-secondary">{movement.reference ?? '—'}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      hideBelowLg: true,
      cell: (movement) => (
        <span className="text-xs text-content-secondary">{movement.reason ?? '—'}</span>
      ),
    },
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
}

function supplierColumns(): Array<Column<Supplier>> {
  return [
    {
      key: 'supplier',
      header: 'Supplier',
      sortKey: 'name',
      primary: true,
      cell: (supplier) => (
        <Link href={`/suppliers/${supplier.id}`} className="group min-w-0 rounded">
          <p className="truncate text-[0.8125rem] font-medium text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-300">
            {supplier.name}
          </p>
          {supplier.code ? (
            <p className="mt-0.5 font-mono text-xs text-content-tertiary">{supplier.code}</p>
          ) : null}
        </Link>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelowLg: true,
      cell: (supplier) => (
        <span className="text-xs text-content-secondary">
          {supplier.contact_name ?? supplier.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      cell: (supplier) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(supplier.linked_products_count ?? 0)}
        </span>
      ),
    },
    {
      key: 'batches',
      header: 'Batches',
      sortKey: 'batches_count',
      align: 'right',
      cell: (supplier) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(supplier.batches_count ?? 0)}
        </span>
      ),
    },
    {
      key: 'units',
      header: 'Units supplied',
      sortKey: 'units_supplied',
      align: 'right',
      cell: (supplier) => (
        <span className="text-[0.8125rem] font-semibold tabular-nums text-content-primary">
          {formatQuantity(supplier.units_supplied ?? 0)}
        </span>
      ),
    },
    {
      key: 'lead',
      header: 'Lead time',
      align: 'right',
      hideBelowLg: true,
      cell: (supplier) => (
        <span className="text-xs tabular-nums text-content-tertiary">
          {supplier.default_lead_time_days ? `${supplier.default_lead_time_days}d` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (supplier) => <ActiveBadge active={supplier.is_active} />,
    },
  ];
}

function ledgerColumns(): Array<Column<LedgerEntry>> {
  return [
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
      key: 'product',
      header: 'Product',
      cell: (entry) =>
        entry.product ? (
          <Link href={`/products/${entry.product.id}`} className="group min-w-0 rounded">
            <p className="truncate text-[0.8125rem] font-medium text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-300">
              {entry.product.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary">
              {entry.product.sku}
            </p>
          </Link>
        ) : (
          <span className="text-xs text-content-tertiary">Unknown</span>
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
        <span className="font-mono text-xs whitespace-nowrap text-content-tertiary">
          {entry.batch?.batch_number ?? '—'}
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs text-content-secondary">{entry.supplier?.name ?? '—'}</span>
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
    {
      key: 'user',
      header: 'By',
      align: 'right',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs whitespace-nowrap text-content-tertiary">
          {entry.user?.name ?? 'System'}
        </span>
      ),
    },
  ];
}

function priceHistoryColumns(): Array<Column<ProductPriceHistoryEntry>> {
  return [
    {
      key: 'product',
      header: 'Product',
      primary: true,
      cell: (entry) =>
        entry.product ? (
          <Link href={`/products/${entry.product.id}`} className="group min-w-0 rounded">
            <p className="truncate text-[0.8125rem] font-medium text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-300">
              {entry.product.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary">
              {entry.product.sku}
            </p>
          </Link>
        ) : (
          <span className="text-xs text-content-tertiary">Unknown</span>
        ),
    },
    {
      key: 'effective',
      header: 'Effective from',
      cell: (entry) => (
        <span className="text-[0.8125rem] whitespace-nowrap text-content-secondary">
          {formatDate(entry.effective_from)}
        </span>
      ),
    },
    {
      key: 'until',
      header: 'Until',
      hideBelowLg: true,
      cell: (entry) =>
        entry.effective_to ? (
          <span className="text-[0.8125rem] whitespace-nowrap text-content-secondary">
            {formatDate(entry.effective_to)}
          </span>
        ) : (
          <Badge tone="positive" size="sm">
            Current
          </Badge>
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
      key: 'previous',
      header: 'Previous',
      align: 'right',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs tabular-nums text-content-tertiary">
          {entry.previous_price ? formatCurrency(entry.previous_price, entry.currency) : '—'}
        </span>
      ),
    },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      cell: (entry) =>
        entry.change_percentage === null ? (
          <span className="text-xs text-content-tertiary">First</span>
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
  ];
}
