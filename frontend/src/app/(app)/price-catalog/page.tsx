'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { FilterBar } from '@/components/shared/filter-bar';
import { CategoryChip } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RowActions } from '@/components/ui/dropdown';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { Alert, EmptyState, ErrorState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { deletePrice, fetchPrices, fetchProducts, savePrice } from '@/lib/data-source';
import { formatCurrency, formatDate, toDateInputValue } from '@/lib/format';
import { useAsync, useSubmit } from '@/lib/use-async';
import type { ListFilters, Product, ProductPrice } from '@/types/api';

/**
 * The product price / reference catalogue.
 *
 * Kept visibly separate from inventory: its own nav entry, its own permission,
 * and a standing note explaining that nothing here affects a quantity. The
 * backend enforces the separation structurally — this page just makes it legible.
 */
export default function PriceCatalogPage() {
  const toast = useToast();
  const { can } = useAuth();

  const [filters, setFilters] = useState<ListFilters>({ per_page: 25, page: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductPrice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductPrice | null>(null);

  const { data, loading, error, reload } = useAsync(() => fetchPrices(filters), [filters]);

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      await deletePrice(deleteTarget.id);
      toast.success('Reference price removed', 'The price history has been kept.');
      reload();
    } catch {
      toast.error('That did not work', 'Please try again.');
    } finally {
      setDeleteTarget(null);
    }
  }

  const columns: Array<Column<ProductPrice>> = [
    {
      key: 'product',
      header: 'Product',
      primary: true,
      cell: (price) =>
        price.product ? (
          <Link href={`/products/${price.product.id}`} className="group min-w-0 rounded">
            <p className="truncate text-[0.8125rem] font-medium text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-300">
              {price.product.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-content-tertiary">
              {price.product.sku}
            </p>
          </Link>
        ) : (
          <span className="text-xs text-content-tertiary">Unknown product</span>
        ),
    },
    {
      key: 'category',
      header: 'Category',
      hideBelowLg: true,
      cell: (price) =>
        price.product?.category ? (
          <CategoryChip
            name={price.product.category.name}
            color={price.product.category.color}
          />
        ) : (
          <span className="text-xs text-content-tertiary">—</span>
        ),
    },
    {
      key: 'price',
      header: 'Reference price',
      align: 'right',
      cell: (price) => (
        <span className="text-[0.8125rem] font-semibold tabular-nums text-content-primary">
          {formatCurrency(price.reference_price, price.currency)}
        </span>
      ),
    },
    {
      key: 'effective',
      header: 'Effective from',
      align: 'right',
      cell: (price) => (
        <span className="text-[0.8125rem] whitespace-nowrap text-content-secondary">
          {formatDate(price.effective_from)}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      hideBelowLg: true,
      cell: (price) => (
        <span className="text-xs text-content-secondary">{price.source ?? '—'}</span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated by',
      align: 'right',
      hideBelowLg: true,
      cell: (price) => (
        <span className="text-xs whitespace-nowrap text-content-tertiary">
          {price.updated_by?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      hideOnMobile: true,
      cell: (price) =>
        can('prices.manage') ? (
          <RowActions
            items={[
              {
                label: 'Update price',
                icon: 'edit',
                onClick: () => {
                  setEditing(price);
                  setFormOpen(true);
                },
              },
              ...(price.product
                ? ([
                    {
                      label: 'View price history',
                      icon: 'history' as const,
                      href: `/products/${price.product.id}`,
                    },
                  ] as const)
                : []),
              'separator',
              {
                label: 'Remove price',
                icon: 'trash',
                destructive: true,
                onClick: () => setDeleteTarget(price),
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Price reference catalogue"
        description="Reference prices for quoting and reordering, with their full history."
        actions={
          can('prices.manage') ? (
            <Button
              icon="plus"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Record a price
            </Button>
          ) : null
        }
      />

      <Alert tone="info" icon="info" title="Reference data, separate from inventory">
        Prices recorded here never take part in quantity arithmetic, FIFO consumption or ledger
        balances. Changing a price cannot change your stock, and Ozipco Inventory does not compute an
        inventory valuation from them.
      </Alert>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        loading={loading}
        enabled={['search', 'category', 'product']}
        searchPlaceholder="Search by product name or SKU…"
      />

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.data ?? []}
              rowKey={(price) => price.id}
              loading={loading && !data}
              empty={
                filters.search || filters.category_id ? (
                  <EmptyState
                    icon="search"
                    title="No prices match"
                    description="Try a different search term or clear the filters."
                    action={{
                      label: 'Clear filters',
                      onClick: () => setFilters({ per_page: filters.per_page, page: 1 }),
                    }}
                  />
                ) : (
                  <EmptyState
                    icon="file-text"
                    title="No reference prices yet"
                    description="Record a reference price for a product to start tracking what it lists at, and how that changes over time."
                    action={
                      can('prices.manage')
                        ? {
                            label: 'Record your first price',
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

      <PriceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        price={editing}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove this reference price?"
        confirmLabel="Remove price"
        message={
          <>
            <strong className="text-content-primary">{deleteTarget?.product?.name}</strong> will no
            longer have a current reference price.
          </>
        }
        detail="The price history is kept — it is a record of what the price was, and removing the current entry does not unmake that."
      />
    </div>
  );
}

/* ========================================================================== */
/* Form                                                                       */
/* ========================================================================== */

function PriceFormModal({
  open,
  onClose,
  price,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  price: ProductPrice | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEditing = Boolean(price);

  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    product_id: '',
    reference_price: '',
    currency: 'USD',
    effective_from: '',
    source: '',
    notes: '',
  });

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(savePrice);

  useEffect(() => {
    if (!open) return;

    reset();
    setForm({
      product_id: price?.product_id ? String(price.product_id) : '',
      reference_price: price?.reference_price ? Number(price.reference_price).toFixed(2) : '',
      currency: price?.currency ?? 'USD',
      effective_from: price?.effective_from
        ? toDateInputValue(price.effective_from)
        : toDateInputValue(new Date()),
      source: price?.source ?? '',
      notes: price?.notes ?? '',
    });
  }, [open, price, reset]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void fetchProducts({ per_page: 300 })
      .then((page) => {
        if (!cancelled) setProducts(page.data);
      })
      .catch(() => {
        /* select stays empty */
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSubmit() {
    const saved = await submit({
      product_id: Number(form.product_id),
      reference_price: form.reference_price,
      currency: form.currency,
      effective_from: form.effective_from || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
    });

    if (saved) {
      toast.success(
        'Reference price saved',
        'The previous price has been closed off in the history.',
      );
      onSaved();
      onClose();
    }
  }

  const canSubmit = Boolean(form.product_id) && Number(form.reference_price) >= 0 && form.reference_price !== '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Update reference price' : 'Record a reference price'}
      description="Recording a price closes the previous one in the history, so you keep a full record of what changed and when."
      icon="tag"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
            Save price
          </Button>
        </>
      }
    >
      <div className="space-y-5 pt-1">
        {error ? <Alert tone="critical">{error}</Alert> : null}

        <Field label="Product" required error={fieldErrors.product_id}>
          <Select
            value={form.product_id}
            placeholder="Choose a product…"
            options={products.map((product) => ({
              value: product.id,
              label: `${product.name} — ${product.sku}`,
            }))}
            onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}
            disabled={submitting || isEditing}
            size="lg"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Reference price" required error={fieldErrors.reference_price}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.reference_price}
              onChange={(event) =>
                setForm((current) => ({ ...current, reference_price: event.target.value }))
              }
              placeholder="0.00"
              disabled={submitting}
              size="lg"
            />
          </Field>

          <Field label="Currency" error={fieldErrors.currency}>
            <Input
              value={form.currency}
              maxLength={3}
              onChange={(event) =>
                setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
              }
              className="uppercase"
              disabled={submitting}
              size="lg"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Effective from"
            error={fieldErrors.effective_from}
            hint="When this price starts applying."
          >
            <Input
              type="date"
              value={form.effective_from}
              onChange={(event) =>
                setForm((current) => ({ ...current, effective_from: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>

          <Field label="Source" error={fieldErrors.source} hint="Where the figure came from.">
            <Input
              value={form.source}
              onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
              placeholder="Supplier list, Q3"
              disabled={submitting}
            />
          </Field>
        </div>

        <Field label="Notes" error={fieldErrors.notes}>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Context for whoever reads this later."
            rows={2}
            disabled={submitting}
          />
        </Field>
      </div>
    </Modal>
  );
}
