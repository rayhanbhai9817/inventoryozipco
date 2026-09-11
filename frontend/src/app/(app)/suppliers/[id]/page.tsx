'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { SupplierFormModal } from '@/components/suppliers/supplier-form-modal';
import { ActiveBadge, Badge, CategoryChip } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, KpiCard, StatList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { DataTable, type Column } from '@/components/ui/table';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/components/ui/states';
import { useAuth } from '@/lib/auth';
import {
  fetchSupplier,
  fetchSupplierBatches,
  fetchSupplierMovements,
} from '@/lib/data-source';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatQuantity,
  formatRelative,
  formatSigned,
} from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { ProductSummary, StockBatch, StockMovement } from '@/types/api';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'products' | 'batches' | 'receipts';

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const supplierId = Number(params.id);

  const [tab, setTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);

  const supplier = useAsync(() => fetchSupplier(supplierId), [supplierId], {
    enabled: Number.isFinite(supplierId),
  });

  if (supplier.loading && !supplier.data) {
    return <LoadingState label="Loading supplier…" />;
  }

  if (supplier.error || !supplier.data) {
    return (
      <Card>
        <ErrorState
          title="We could not load this supplier"
          message={supplier.error ?? 'It may have been removed, or it belongs to another business.'}
          onRetry={supplier.reload}
        />
        <div className="flex justify-center pb-6">
          <ButtonLink href="/suppliers" variant="secondary" icon="arrow-left">
            Back to suppliers
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const item = supplier.data;

  const tabs: Array<TabItem<TabKey>> = [
    { value: 'overview', label: 'Overview', icon: 'info' },
    { value: 'products', label: 'Products', icon: 'package', count: item.products?.length },
    { value: 'batches', label: 'Batches', icon: 'layers', count: item.batches_count },
    { value: 'receipts', label: 'Receipt history', icon: 'activity' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
            <Link
              href="/suppliers"
              className="rounded text-content-tertiary transition-colors hover:text-content-primary"
            >
              Suppliers
            </Link>
            <Icon name="chevron-right" size={12} className="text-content-tertiary" />
            <span className="truncate font-medium text-content-secondary">
              {item.code ?? item.name}
            </span>
          </nav>
        }
        title={item.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {item.code ? (
              <span className="font-mono text-xs text-content-tertiary">{item.code}</span>
            ) : null}
            <ActiveBadge active={item.is_active} />
            {item.default_lead_time_days ? (
              <Badge tone="neutral" icon="clock">
                {item.default_lead_time_days} day lead time
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <>
            {item.website ? (
              <ButtonLink
                href={item.website}
                external
                variant="secondary"
                size="sm"
                trailingIcon="external-link"
              >
                Website
              </ButtonLink>
            ) : null}
            {can('suppliers.manage') ? (
              <Button size="sm" icon="edit" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Units supplied"
          value={formatQuantity(item.units_supplied ?? 0)}
          caption="Across every receipt"
          icon="boxes"
          tone="brand"
        />
        <KpiCard
          label="Batches received"
          value={formatQuantity(item.batches_count ?? 0)}
          caption="Each one traceable"
          icon="layers"
          tone="neutral"
        />
        <KpiCard
          label="Products linked"
          value={formatQuantity(item.linked_products_count ?? item.products?.length ?? 0)}
          caption="They can supply many"
          icon="package"
          tone="neutral"
        />
        <KpiCard
          label="Lead time"
          value={item.default_lead_time_days ? `${item.default_lead_time_days}d` : '—'}
          caption="Order to delivery"
          icon="clock"
          tone="neutral"
        />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} aria-label="Supplier sections" />

      {tab === 'overview' ? <OverviewTab supplierId={item.id} /> : null}
      {tab === 'products' ? <ProductsTab products={item.products ?? []} /> : null}
      {tab === 'batches' ? <BatchesTab supplierId={item.id} /> : null}
      {tab === 'receipts' ? <ReceiptsTab supplierId={item.id} /> : null}

      <SupplierFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        supplier={item}
        onSaved={supplier.reload}
        allowProductLinks={false}
      />
    </div>
  );
}

/* ========================================================================== */

function OverviewTab({ supplierId }: { supplierId: number }) {
  const supplier = useAsync(() => fetchSupplier(supplierId), [supplierId]);
  const item = supplier.data;

  if (!item) return <CardSkeleton lines={6} />;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Supplier information" icon="building" />
        <div className="mt-5 space-y-5">
          <StatList
            columns={2}
            items={[
              { label: 'Code', value: item.code ? <span className="font-mono">{item.code}</span> : '—' },
              { label: 'Contact', value: item.contact_name ?? '—' },
              {
                label: 'Email',
                value: item.email ? (
                  <a
                    href={`mailto:${item.email}`}
                    className="rounded text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {item.email}
                  </a>
                ) : (
                  '—'
                ),
              },
              { label: 'Phone', value: item.phone ?? '—' },
              {
                label: 'Lead time',
                value: item.default_lead_time_days ? `${item.default_lead_time_days} days` : '—',
              },
              { label: 'Added', value: formatDate(item.created_at) },
            ]}
          />

          {item.address.formatted || item.address.line1 ? (
            <div className="border-t border-border-subtle pt-5">
              <p className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
                Address
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
                {item.address.formatted ??
                  [
                    item.address.line1,
                    item.address.line2,
                    item.address.city,
                    item.address.state,
                    item.address.postal_code,
                    item.address.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
              </p>
            </div>
          ) : null}

          {item.notes ? (
            <div className="border-t border-border-subtle pt-5">
              <p className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
                Notes
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">{item.notes}</p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Quick actions" icon="zap" />
        <div className="mt-4 space-y-2">
          <ButtonLink
            href={`/stock-in?new=1`}
            variant="secondary"
            fullWidth
            icon="arrow-down-right"
          >
            Record a receipt
          </ButtonLink>
          <ButtonLink
            href={`/reports/stock-in?supplier=${item.id}`}
            variant="secondary"
            fullWidth
            icon="activity"
          >
            Stock in report
          </ButtonLink>
          <ButtonLink
            href={`/products?supplier=${item.id}`}
            variant="secondary"
            fullWidth
            icon="package"
          >
            Products they supply
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

function ProductsTab({ products }: { products: ProductSummary[] }) {
  const columns: Array<Column<ProductSummary>> = [
    {
      key: 'product',
      header: 'Product',
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
      cell: (product) =>
        product.category ? (
          <CategoryChip name={product.category.name} color={product.category.color} />
        ) : (
          <span className="text-xs text-content-tertiary">—</span>
        ),
    },
    {
      key: 'unit',
      header: 'Unit',
      align: 'right',
      cell: (product) => (
        <span className="text-xs text-content-secondary">{product.unit.label}</span>
      ),
    },
  ];

  return (
    <Card flush>
      <CardHeader
        padded
        title="Products supplied"
        description="A supplier can supply many products, and a product can come from many suppliers."
        icon="package"
      />
      <DataTable
        columns={columns}
        rows={products}
        rowKey={(product) => product.id}
        empty={
          <EmptyState
            compact
            icon="package"
            title="No products linked"
            description="Link products to this supplier from the product page or when editing the supplier."
            action={{ label: 'Go to products', href: '/products' }}
          />
        }
      />
    </Card>
  );
}

function BatchesTab({ supplierId }: { supplierId: number }) {
  const { data, loading, error, reload } = useAsync(
    () => fetchSupplierBatches(supplierId, { per_page: 50 }),
    [supplierId],
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
      key: 'reference',
      header: 'Reference',
      hideBelowLg: true,
      cell: (batch) => (
        <span className="text-xs text-content-secondary">{batch.reference ?? '—'}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'Received',
      align: 'right',
      cell: (batch) => (
        <span className="text-[0.8125rem] font-semibold tabular-nums text-content-primary">
          {formatQuantity(batch.quantity_received)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'Remaining',
      align: 'right',
      cell: (batch) => (
        <span
          className={cn(
            'text-[0.8125rem] tabular-nums',
            batch.is_depleted ? 'text-content-tertiary' : 'text-content-secondary',
          )}
        >
          {formatQuantity(batch.quantity_remaining)}
        </span>
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
  ];

  return (
    <Card flush>
      <CardHeader
        padded
        title="Batches supplied"
        description="Every batch this supplier delivered, and how much of each is left."
        icon="layers"
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} compact />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(batch) => batch.id}
          loading={loading && !data}
          dense
          empty={
            <EmptyState
              compact
              icon="layers"
              title="No batches from this supplier yet"
              description="Record a receipt and choose this supplier to create one."
            />
          }
        />
      )}
    </Card>
  );
}

function ReceiptsTab({ supplierId }: { supplierId: number }) {
  const { data, loading, error, reload } = useAsync(
    () => fetchSupplierMovements(supplierId, { per_page: 50 }),
    [supplierId],
  );

  const columns: Array<Column<StockMovement>> = [
    {
      key: 'when',
      header: 'When',
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
    {
      key: 'reference',
      header: 'Reference',
      hideBelowLg: true,
      cell: (movement) => (
        <span className="text-[0.8125rem] text-content-secondary">{movement.reference ?? '—'}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      cell: (movement) => (
        <span className="text-[0.8125rem] font-semibold tabular-nums text-positive-700 dark:text-positive-300">
          {formatSigned(movement.signed_quantity)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance after',
      align: 'right',
      hideBelowLg: true,
      cell: (movement) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(movement.balance_after)}
        </span>
      ),
    },
    {
      key: 'by',
      header: 'Recorded by',
      align: 'right',
      hideBelowLg: true,
      cell: (movement) => (
        <span className="text-xs whitespace-nowrap text-content-tertiary">
          {movement.created_by?.name ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <Card flush>
      <CardHeader
        padded
        title="Receipt history"
        description="Stock received from this supplier over time."
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
              title="No receipts from this supplier yet"
              description="Receipts appear here once you record a stock in against them."
            />
          }
        />
      )}
    </Card>
  );
}
