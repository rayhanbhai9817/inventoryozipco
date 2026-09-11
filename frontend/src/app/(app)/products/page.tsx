'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { ProductFormModal } from '@/components/products/product-form-modal';
import { FilterBar } from '@/components/shared/filter-bar';
import { CategoryChip, StockStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RowActions } from '@/components/ui/dropdown';
import { ConfirmDialog } from '@/components/ui/modal';
import { DataTable, Pagination, type Column, type SortState } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { archiveProduct, fetchProducts, restoreProduct } from '@/lib/data-source';
import { formatQuantity } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { ListFilters, Product } from '@/types/api';
import { cn } from '@/lib/utils';

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading products…" />}>
      <ProductsView />
    </Suspense>
  );
}

function ProductsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { can } = useAuth();

  const [filters, setFilters] = useState<ListFilters>({ per_page: 25, page: 1 });
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => fetchProducts({ ...filters, sort: sort.key, direction: sort.direction }),
    [filters, sort],
  );

  // `?new=1` from the topbar's quick-create menu opens the form directly.
  useEffect(() => {
    if (searchParams.get('new') === '1' && can('products.manage')) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/products');
    }
  }, [searchParams, can, router]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;

    const wasArchived = archiveTarget.is_archived;

    try {
      if (wasArchived) {
        await restoreProduct(archiveTarget.id);
        toast.success('Product restored', `${archiveTarget.name} is active again.`);
      } else {
        await archiveProduct(archiveTarget.id);
        toast.success(
          'Product archived',
          `${archiveTarget.name} is hidden from pickers. Its history is intact.`,
        );
      }

      reload();
    } catch {
      toast.error('That did not work', 'Please try again.');
    } finally {
      setArchiveTarget(null);
    }
  }

  const totals = data?.meta.totals;

  const columns: Array<Column<Product>> = [
    {
      key: 'product',
      header: 'Product',
      sortKey: 'name',
      primary: true,
      cell: (product) => (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-[0.625rem] font-bold text-content-tertiary">
            {product.unit.abbreviation.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-content-primary">
              {product.name}
              {product.is_archived ? (
                <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[0.625rem] font-semibold text-content-tertiary dark:bg-surface-raised">
                  Archived
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary">{product.sku}</p>
          </div>
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
          <span className="text-xs text-content-tertiary">Uncategorised</span>
        ),
    },
    {
      key: 'suppliers',
      header: 'Suppliers',
      hideBelowLg: true,
      cell: (product) => {
        const names = product.suppliers?.map((supplier) => supplier.name) ?? [];

        if (names.length === 0) {
          return <span className="text-xs text-caution-700 dark:text-caution-300">None linked</span>;
        }

        return (
          <span className="text-xs text-content-secondary">
            {names[0]}
            {names.length > 1 ? (
              <span className="ml-1 text-content-tertiary">+{names.length - 1}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'quantity',
      header: 'On hand',
      sortKey: 'quantity_on_hand',
      align: 'right',
      cell: (product) => (
        <span className="tabular-nums">
          <span
            className={cn(
              'font-semibold',
              product.quantity_on_hand === 0
                ? 'text-critical-600 dark:text-critical-300'
                : 'text-content-primary',
            )}
          >
            {formatQuantity(product.quantity_on_hand)}
          </span>
          <span className="ml-1 text-xs text-content-tertiary">{product.unit.abbreviation}</span>
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
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (product) => (
        <StockStatusBadge status={product.stock_status.value} label={product.stock_status.label} />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      hideOnMobile: true,
      cell: (product) => (
        <div onClick={(event) => event.stopPropagation()}>
          <RowActions
            items={[
              { label: 'View details', icon: 'eye', href: `/products/${product.id}` },
              ...(can('products.manage')
                ? ([
                    {
                      label: 'Edit product',
                      icon: 'edit' as const,
                      onClick: () => {
                        setEditing(product);
                        setFormOpen(true);
                      },
                    },
                  ] as const)
                : []),
              ...(can('inventory.stock-in')
                ? ([
                    {
                      label: 'Record stock in',
                      icon: 'arrow-down-right' as const,
                      href: `/stock-in?new=1&product=${product.id}`,
                    },
                  ] as const)
                : []),
              ...(can('inventory.stock-out') && product.quantity_on_hand > 0
                ? ([
                    {
                      label: 'Record stock out',
                      icon: 'arrow-up-right' as const,
                      href: `/stock-out?new=1&product=${product.id}`,
                    },
                  ] as const)
                : []),
              ...(can('products.delete')
                ? ([
                    'separator' as const,
                    {
                      label: product.is_archived ? 'Restore product' : 'Archive product',
                      icon: product.is_archived ? ('refresh' as const) : ('archive' as const),
                      destructive: !product.is_archived,
                      onClick: () => setArchiveTarget(product),
                    },
                  ] as const)
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        description="Your catalogue, with current stock position on every row."
        actions={
          can('products.manage') ? (
            <Button icon="plus" onClick={openCreate}>
              New product
            </Button>
          ) : null
        }
      />

      {/* ---------- Summary strip ---------- */}
      {totals ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Products" value={formatQuantity(totals.products)} />
          <SummaryTile label="Units on hand" value={formatQuantity(totals.units)} />
          <SummaryTile
            label="Low stock"
            value={formatQuantity(totals.low_stock)}
            tone={totals.low_stock > 0 ? 'caution' : 'neutral'}
          />
          <SummaryTile
            label="Out of stock"
            value={formatQuantity(totals.out_of_stock)}
            tone={totals.out_of_stock > 0 ? 'critical' : 'neutral'}
          />
        </div>
      ) : null}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        searchPlaceholder="Search by name, SKU or barcode…"
        enabled={['search', 'category', 'supplier', 'stockStatus', 'includeArchived']}
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
                filters.search || filters.category_id || filters.stock_status ? (
                  <EmptyState
                    icon="search"
                    title="No products match these filters"
                    description="Try a different search term, or clear the filters to see your whole catalogue."
                    action={{
                      label: 'Clear filters',
                      onClick: () => setFilters({ per_page: filters.per_page, page: 1 }),
                    }}
                  />
                ) : (
                  <EmptyState
                    icon="package"
                    title="Your catalogue is empty"
                    description="Add your first product, then record a receipt to start tracking its stock."
                    action={
                      can('products.manage')
                        ? { label: 'Add your first product', onClick: openCreate, icon: 'plus' }
                        : undefined
                    }
                  />
                )
              }
              mobileActions={(product) => (
                <StockStatusBadge
                  status={product.stock_status.value}
                  label={product.stock_status.label}
                />
              )}
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

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        onSaved={reload}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveConfirm}
        tone={archiveTarget?.is_archived ? 'primary' : 'danger'}
        title={archiveTarget?.is_archived ? 'Restore this product?' : 'Archive this product?'}
        confirmLabel={archiveTarget?.is_archived ? 'Restore product' : 'Archive product'}
        message={
          archiveTarget?.is_archived ? (
            <>
              <strong className="text-content-primary">{archiveTarget.name}</strong> will become
              active again and available for new stock movements.
            </>
          ) : (
            <>
              <strong className="text-content-primary">{archiveTarget?.name}</strong> will be hidden
              from pickers and no new movements can be recorded against it.
            </>
          )
        }
        detail={
          archiveTarget?.is_archived
            ? undefined
            : 'Its batches, movements and ledger history are kept in full — archiving never deletes inventory history.'
        }
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'caution' | 'critical';
}) {
  const tones = {
    neutral: 'text-content-primary',
    caution: 'text-caution-700 dark:text-caution-300',
    critical: 'text-critical-700 dark:text-critical-300',
  };

  return (
    <div className="rounded-xl bg-surface-card p-3.5 ring-1 ring-border-subtle">
      <p className="text-xs font-medium text-content-tertiary">{label}</p>
      <p
        className={cn('mt-1 font-display text-xl leading-none font-semibold tabular-nums', tones[tone])}
      >
        {value}
      </p>
    </div>
  );
}
