'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { fetchProducts, fetchSuppliers, recordStockIn } from '@/lib/data-source';
import { formatQuantity } from '@/lib/format';
import { useSubmit } from '@/lib/use-async';
import type { Product, Supplier } from '@/types/api';

/**
 * Record a receipt of stock.
 *
 * The form shows what will happen before it happens: pick a product and it tells
 * you the current balance; enter a quantity and it tells you the balance
 * afterwards. Unit cost is explicitly labelled as reference-only, so nobody
 * expects it to value their inventory.
 */
export interface StockInModalProps {
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
  /** Preselect a product, e.g. from a product page's "Stock in" action. */
  initialProductId?: number | null;
}

export function StockInModal({ open, onClose, onRecorded, initialProductId }: StockInModalProps) {
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    supplier_id: '',
    reference: '',
    batch_number: '',
    unit_cost: '',
    received_at: '',
    expires_at: '',
    notes: '',
  });

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(recordStockIn);

  useEffect(() => {
    if (!open) return;

    reset();
    setForm({
      product_id: initialProductId ? String(initialProductId) : '',
      quantity: '',
      supplier_id: '',
      reference: '',
      batch_number: '',
      unit_cost: '',
      // Default to now, formatted for `datetime-local`.
      received_at: toLocalDateTimeValue(new Date()),
      expires_at: '',
      notes: '',
    });
  }, [open, initialProductId, reset]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void Promise.all([
      fetchProducts({ per_page: 300 }),
      fetchSuppliers({ per_page: 200 }),
    ])
      .then(([productPage, supplierPage]) => {
        if (cancelled) return;

        setProducts(productPage.data.filter((product) => !product.is_archived));
        setSuppliers(supplierPage.data);
      })
      .catch(() => {
        /* the selects stay empty; validation will catch an empty submit */
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === form.product_id),
    [products, form.product_id],
  );

  const quantity = Number(form.quantity || 0);
  const balanceAfter = selectedProduct ? selectedProduct.quantity_on_hand + quantity : null;

  // Suppliers already linked to this product come first; it is almost always one
  // of them, and scanning a short list beats scanning a long one.
  const supplierOptions = useMemo(() => {
    if (!selectedProduct?.suppliers?.length) {
      return suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }));
    }

    const linkedIds = new Set(selectedProduct.suppliers.map((supplier) => supplier.id));

    return [
      ...suppliers
        .filter((supplier) => linkedIds.has(supplier.id))
        .map((supplier) => ({ value: supplier.id, label: `${supplier.name} — linked` })),
      ...suppliers
        .filter((supplier) => !linkedIds.has(supplier.id))
        .map((supplier) => ({ value: supplier.id, label: supplier.name })),
    ];
  }, [suppliers, selectedProduct]);

  async function handleSubmit() {
    const movement = await submit({
      product_id: Number(form.product_id),
      quantity,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      batch_number: form.batch_number.trim() || null,
      reference: form.reference.trim() || null,
      unit_cost: form.unit_cost ? form.unit_cost : null,
      received_at: form.received_at ? new Date(form.received_at).toISOString() : null,
      expires_at: form.expires_at || null,
      notes: form.notes.trim() || null,
    });

    if (movement) {
      toast.success(
        'Stock in recorded',
        `${formatQuantity(movement.quantity)} ${movement.product?.unit.abbreviation ?? 'units'} received. Balance is now ${formatQuantity(movement.balance_after)}.`,
      );
      onRecorded();
      onClose();
    }
  }

  const canSubmit = Boolean(form.product_id) && quantity > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record stock in"
      description="This opens a new dated batch and increases the quantity on hand."
      icon="arrow-down-right"
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            icon="arrow-down-right"
          >
            Record receipt
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
            disabled={submitting}
            size="lg"
          />
        </Field>

        {/* Before/after preview — the consequence of the form, stated plainly. */}
        {selectedProduct ? (
          <div className="flex items-center gap-4 rounded-xl bg-surface-sunken/70 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
                Current balance
              </p>
              <p className="mt-1 font-display text-xl leading-none font-semibold tabular-nums text-content-primary">
                {formatQuantity(selectedProduct.quantity_on_hand)}
                <span className="ml-1.5 text-sm font-normal text-content-tertiary">
                  {selectedProduct.unit.abbreviation}
                </span>
              </p>
            </div>

            <Icon name="arrow-right" size={18} className="shrink-0 text-content-tertiary" />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
                After this receipt
              </p>
              <p className="mt-1 font-display text-xl leading-none font-semibold tabular-nums text-positive-700 dark:text-positive-300">
                {quantity > 0 ? formatQuantity(balanceAfter) : '—'}
                <span className="ml-1.5 text-sm font-normal text-content-tertiary">
                  {selectedProduct.unit.abbreviation}
                </span>
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quantity received"
            required
            error={fieldErrors.quantity}
            hint={
              selectedProduct
                ? `Whole ${selectedProduct.unit.label.toLowerCase()} units.`
                : 'Whole units.'
            }
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="0"
              suffix={selectedProduct?.unit.abbreviation}
              disabled={submitting}
              size="lg"
            />
          </Field>

          <Field
            label="Supplier"
            error={fieldErrors.supplier_id}
            hint="Attached to the batch, so you can trace the units later."
          >
            <Select
              value={form.supplier_id}
              placeholder="No supplier"
              options={supplierOptions}
              onChange={(event) =>
                setForm((current) => ({ ...current, supplier_id: event.target.value }))
              }
              disabled={submitting}
              size="lg"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reference" error={fieldErrors.reference} hint="Purchase order, invoice, delivery note.">
            <Input
              value={form.reference}
              onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
              placeholder="PO-1042"
              disabled={submitting}
            />
          </Field>

          <Field
            label="Batch number"
            error={fieldErrors.batch_number}
            hint="Leave blank and one is generated for you."
          >
            <Input
              value={form.batch_number}
              onChange={(event) =>
                setForm((current) => ({ ...current, batch_number: event.target.value }))
              }
              placeholder="Auto"
              className="font-mono"
              disabled={submitting}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Received at" error={fieldErrors.received_at} hint="Determines FIFO order.">
            <Input
              type="datetime-local"
              value={form.received_at}
              max={toLocalDateTimeValue(new Date())}
              onChange={(event) =>
                setForm((current) => ({ ...current, received_at: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>

          <Field label="Expires on" error={fieldErrors.expires_at}>
            <Input
              type="date"
              value={form.expires_at}
              onChange={(event) =>
                setForm((current) => ({ ...current, expires_at: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>
        </div>

        <Field
          label="Unit cost"
          error={fieldErrors.unit_cost}
          hint="Captured for traceability only — it is never used to value your inventory."
        >
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.unit_cost}
            onChange={(event) => setForm((current) => ({ ...current, unit_cost: event.target.value }))}
            placeholder="0.00"
            suffix="per unit"
            disabled={submitting}
          />
        </Field>

        <Field label="Notes" error={fieldErrors.notes}>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Anything worth recording about this delivery."
            rows={2}
            disabled={submitting}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** `YYYY-MM-DDTHH:mm` in local time, which is what `datetime-local` expects. */
function toLocalDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
