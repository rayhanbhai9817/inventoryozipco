'use client';

import Link from 'next/link';
import { useState } from 'react';

import { FilterBar } from '@/components/shared/filter-bar';
import { MovementTypeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { Alert, EmptyState, ErrorState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { exportReport, fetchLedger } from '@/lib/data-source';
import { formatDateTime, formatQuantity, formatSigned } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { LedgerEntry, ListFilters } from '@/types/api';
import { cn } from '@/lib/utils';

/**
 * The inventory ledger.
 *
 * Read-only by design — there is no edit affordance anywhere on this page,
 * because the records behind it cannot be edited. Corrections are made by
 * recording an adjustment, which appends a new line.
 */
export default function LedgerPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState<ListFilters>({ per_page: 50, page: 1 });
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useAsync(() => fetchLedger(filters), [filters]);

  async function handleExport() {
    setExporting(true);

    try {
      await exportReport('ledger', filters);
      toast.success('Export ready', 'Your CSV has been downloaded.');
    } catch {
      toast.error('Export failed', 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

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
      key: 'user',
      header: 'By',
      hideBelowLg: true,
      cell: (entry) => (
        <span className="text-xs whitespace-nowrap text-content-secondary">
          {entry.user?.name ?? 'System'}
        </span>
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
              : entry.type.value === 'adjustment'
                ? 'text-caution-700 dark:text-caution-300'
                : 'text-info-700 dark:text-info-300',
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
    <div className="space-y-5">
      <PageHeader
        title="Inventory ledger"
        description="Every quantity change, in order, with the running balance after each one."
        actions={
          can('reports.export') ? (
            <Button
              variant="secondary"
              icon="download"
              onClick={handleExport}
              loading={exporting}
            >
              Export CSV
            </Button>
          ) : null
        }
      />

      <Alert tone="info" icon="lock" title="This record is append-only">
        Ledger lines cannot be edited or deleted — not from this screen, not from the API, not from
        the database layer. A correction is recorded as an adjustment, which appends a new line and
        leaves the original intact.
      </Alert>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        enabled={['dates', 'product', 'supplier', 'movementType']}
      />

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              rowKey={(entry) => entry.id}
              loading={loading && !data}
              dense
              empty={
                <EmptyState
                  icon="file-text"
                  title="The ledger is empty"
                  description="Ledger lines are written automatically as soon as stock moves. Record a receipt to see the first one."
                  action={
                    can('inventory.stock-in')
                      ? { label: 'Record stock in', href: '/stock-in?new=1' }
                      : undefined
                  }
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
