'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { SupplierFormModal } from '@/components/suppliers/supplier-form-modal';
import { FilterBar } from '@/components/shared/filter-bar';
import { ActiveBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RowActions } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { ConfirmDialog } from '@/components/ui/modal';
import { DataTable, Pagination, type Column, type SortState } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { fetchSuppliers, toggleSupplierActive } from '@/lib/data-source';
import { formatQuantity } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { ListFilters, Supplier } from '@/types/api';

export default function SuppliersPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading suppliers…" />}>
      <SuppliersView />
    </Suspense>
  );
}

function SuppliersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { can } = useAuth();

  const [filters, setFilters] = useState<ListFilters>({ per_page: 25, page: 1 });
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Supplier | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => fetchSuppliers({ ...filters, sort: sort.key, direction: sort.direction }),
    [filters, sort],
  );

  useEffect(() => {
    if (searchParams.get('new') === '1' && can('suppliers.manage')) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/suppliers');
    }
  }, [searchParams, can, router]);

  async function handleToggle() {
    if (!toggleTarget) return;

    try {
      await toggleSupplierActive(toggleTarget.id);
      toast.success(
        toggleTarget.is_active ? 'Supplier deactivated' : 'Supplier activated',
        `${toggleTarget.name} has been updated.`,
      );
      reload();
    } catch {
      toast.error('That did not work', 'Please try again.');
    } finally {
      setToggleTarget(null);
    }
  }

  const columns: Array<Column<Supplier>> = [
    {
      key: 'supplier',
      header: 'Supplier',
      sortKey: 'name',
      primary: true,
      cell: (supplier) => (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-content-secondary">
            <Icon name="truck" size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-content-primary">
              {supplier.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-content-tertiary">
              {supplier.code ? <span className="font-mono">{supplier.code}</span> : null}
              {supplier.code && supplier.contact_name ? ' · ' : ''}
              {supplier.contact_name}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelowLg: true,
      cell: (supplier) => (
        <div className="min-w-0 text-xs">
          {supplier.email ? (
            <a
              href={`mailto:${supplier.email}`}
              onClick={(event) => event.stopPropagation()}
              className="block truncate rounded text-content-secondary transition-colors hover:text-brand-600 hover:underline dark:hover:text-brand-300"
            >
              {supplier.email}
            </a>
          ) : null}
          {supplier.phone ? (
            <p className="mt-0.5 truncate text-content-tertiary">{supplier.phone}</p>
          ) : null}
          {!supplier.email && !supplier.phone ? (
            <span className="text-content-tertiary">—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'lead',
      header: 'Lead time',
      align: 'right',
      hideBelowLg: true,
      cell: (supplier) => (
        <span className="text-xs tabular-nums text-content-secondary">
          {supplier.default_lead_time_days ? `${supplier.default_lead_time_days} days` : '—'}
        </span>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      cell: (supplier) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(supplier.linked_products_count ?? supplier.products_count ?? 0)}
        </span>
      ),
    },
    {
      key: 'supplied',
      header: 'Units supplied',
      sortKey: 'units_supplied',
      align: 'right',
      cell: (supplier) => (
        <span className="text-[0.8125rem] font-medium tabular-nums text-content-primary">
          {formatQuantity(supplier.units_supplied ?? 0)}
        </span>
      ),
    },
    {
      key: 'batches',
      header: 'Batches',
      align: 'right',
      hideBelowLg: true,
      cell: (supplier) => (
        <span className="text-xs tabular-nums text-content-tertiary">
          {formatQuantity(supplier.batches_count ?? 0)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (supplier) => <ActiveBadge active={supplier.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      hideOnMobile: true,
      cell: (supplier) => (
        <div onClick={(event) => event.stopPropagation()}>
          <RowActions
            items={[
              { label: 'View details', icon: 'eye', href: `/suppliers/${supplier.id}` },
              ...(can('suppliers.manage')
                ? ([
                    {
                      label: 'Edit supplier',
                      icon: 'edit' as const,
                      onClick: () => {
                        setEditing(supplier);
                        setFormOpen(true);
                      },
                    },
                    'separator' as const,
                    {
                      label: supplier.is_active ? 'Deactivate' : 'Activate',
                      icon: supplier.is_active ? ('archive' as const) : ('refresh' as const),
                      destructive: supplier.is_active,
                      onClick: () => setToggleTarget(supplier),
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
        title="Suppliers"
        description="Who you buy from, what they supply, and how much has come through each of them."
        actions={
          can('suppliers.manage') ? (
            <Button
              icon="plus"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              New supplier
            </Button>
          ) : null
        }
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        enabled={['search', 'includeInactive']}
        searchPlaceholder="Search by name, code, contact or email…"
      />

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              rowKey={(supplier) => supplier.id}
              onRowClick={(supplier) => router.push(`/suppliers/${supplier.id}`)}
              sort={sort}
              onSortChange={setSort}
              loading={loading && !data}
              empty={
                filters.search ? (
                  <EmptyState
                    icon="search"
                    title="No suppliers match"
                    description="Try a different name, code or contact."
                    action={{
                      label: 'Clear search',
                      onClick: () => setFilters({ per_page: filters.per_page, page: 1 }),
                    }}
                  />
                ) : (
                  <EmptyState
                    icon="truck"
                    title="No suppliers yet"
                    description="Add the suppliers you buy from, then link them to products so each receipt records where the stock came from."
                    action={
                      can('suppliers.manage')
                        ? {
                            label: 'Add your first supplier',
                            icon: 'plus',
                            onClick: () => {
                              setEditing(null);
                              setFormOpen(true);
                            },
                          }
                        : undefined
                    }
                  />
                )
              }
              mobileActions={(supplier) => <ActiveBadge active={supplier.is_active} />}
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

      <SupplierFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplier={editing}
        onSaved={reload}
      />

      <ConfirmDialog
        open={toggleTarget !== null}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        tone={toggleTarget?.is_active ? 'caution' : 'primary'}
        title={toggleTarget?.is_active ? 'Deactivate this supplier?' : 'Activate this supplier?'}
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        message={
          toggleTarget?.is_active ? (
            <>
              <strong className="text-content-primary">{toggleTarget.name}</strong> will be hidden
              from the stock-in form.
            </>
          ) : (
            <>
              <strong className="text-content-primary">{toggleTarget?.name}</strong> will be
              available again when recording receipts.
            </>
          )
        }
        detail={
          toggleTarget?.is_active
            ? 'Batches they already supplied keep pointing at them, so your history stays complete.'
            : undefined
        }
      />
    </div>
  );
}
