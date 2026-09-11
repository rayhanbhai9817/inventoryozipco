'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button, Spinner } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { fetchProducts, previewStockOut, recordStockOut } from '@/lib/data-source';
import { formatDate, formatQuantity } from '@/lib/format';
import { useSubmit } from '@/lib/use-async';
import type { FifoPreview, Product } from '@/types/api';
import { cn } from '@/lib/utils';

const REASONS = [
  'Customer order',
  'Trade counter',
  'Branch transfer',
  'Contract job',
  'Sample',
  'Internal use',
];

/**
 * Record a withdrawal of stock.
 *
 * The distinguishing feature is the FIFO preview: as the quantity changes, the
 * form asks the backend which batches would be consumed and shows the answer.
 * The user sees the consequence — including whether there is enough stock —
 * before committing, rather than discovering it from an error.
 *
 * There is no batch selector. Which batches are consumed is the engine's
 * decision, and offering a choice here would imply otherwise.
 */
export interface StockOutModalProps {
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
  initialProductId?: number | null;
}

export function StockOutModal({ open, onClose, onRecorded, initialProductId }: StockOutModalProps) {
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    reference: '',
    reason: '',
    occurred_at: '',
    notes: '',
  });

  const [preview, setPreview] = useState<FifoPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(recordStockOut);

  useEffect(() => {
    if (!open) return;

    reset();
    setPreview(null);
    setForm({
      product_id: initialProductId ? String(initialProductId) : '',
      quantity: '',
      reference: '',
      reason: '',
      occurred_at: toLocalDateTimeValue(new Date()),
      notes: '',
    });
  }, [open, initialProductId, reset]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void fetchProducts({ per_page: 300 })
      .then((page) => {
        if (!cancelled) {
          // Only products that actually hold stock can be withdrawn from.
          setProducts(page.data.filter((product) => !product.is_archived));
        }
      })
      .catch(() => {
        /* select stays empty */
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

  // Debounced FIFO preview. Skipped entirely when there is nothing to preview,
  // so an empty form makes no requests.
  useEffect(() => {
    if (!form.product_id || quantity <= 0) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    let cancelled = false;

    const timer = setTimeout(() => {
      void previewStockOut(Number(form.product_id), quantity)
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.product_id, quantity]);

  async function handleSubmit() {
    const movement = await submit({
      product_id: Number(form.product_id),
      quantity,
      reference: form.reference.trim() || null,
      reason: form.reason || null,
      occurred_at: form.occurred_at ? new Date(form.occurred_at).toISOString() : null,
      notes: form.notes.trim() || null,
    });

    if (movement) {
      toast.success(
        'Stock out recorded',
        `${formatQuantity(movement.quantity)} ${movement.product?.unit.abbreviation ?? 'units'} issued. Balance is now ${formatQuantity(movement.balance_after)}.`,
      );
      onRecorded();
      onClose();
    }
  }

  const insufficient = preview !== null && !preview.sufficient;
  const canSubmit = Boolean(form.product_id) && quantity > 0 && !insufficient;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record stock out"
      description="Stock is consumed oldest batch first. The allocation below is what will happen."
      icon="arrow-up-right"
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
            icon="arrow-up-right"
          >
            Record withdrawal
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
              label: `${product.name} — ${product.sku} (${formatQuantity(product.quantity_on_hand)} ${product.unit.abbreviation})`,
            }))}
            onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}
            disabled={submitting}
            size="lg"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quantity to issue"
            required
            error={fieldErrors.quantity}
            hint={
              selectedProduct
                ? `${formatQuantity(selectedProduct.quantity_on_hand)} ${selectedProduct.unit.abbreviation} available`
                : undefined
            }
          >
            <Input
              type="number"
              min={1}
              step={1}
              max={selectedProduct?.quantity_on_hand}
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="0"
              suffix={selectedProduct?.unit.abbreviation}
              invalid={insufficient}
              disabled={submitting}
              size="lg"
            />
          </Field>

          <Field label="Reason" error={fieldErrors.reason}>
            <Select
              value={form.reason}
              placeholder="Not specified"
              options={REASONS.map((reason) => ({ value: reason, label: reason }))}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              disabled={submitting}
              size="lg"
            />
          </Field>
        </div>

        {/* ---------- FIFO preview ---------- */}
        {form.product_id && quantity > 0 ? (
          <div
            className={cn(
              'overflow-hidden rounded-xl ring-1 ring-inset',
              insufficient
                ? 'bg-critical-50 ring-critical-500/25 dark:bg-critical-700/10'
                : 'bg-surface-sunken/70 ring-border-subtle',
            )}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="flex items-center gap-2 text-[0.8125rem] font-semibold text-content-primary">
                <Icon name="layers" size={15} />
                FIFO allocation
              </p>
              {previewLoading ? (
                <Spinner size={14} className="text-brand-500" />
              ) : preview ? (
                <p className="text-xs tabular-nums text-content-tertiary">
                  {formatQuantity(preview.available)} available
                </p>
              ) : null}
            </div>

            {insufficient && preview ? (
              <div className="border-t border-critical-500/20 px-4 py-3">
                <p className="flex items-start gap-2 text-[0.8125rem] text-critical-700 dark:text-critical-200">
                  <Icon name="alert-circle" size={15} className="mt-px shrink-0" />
                  <span>
                    Not enough stock. You asked for{' '}
                    <strong className="tabular-nums">{formatQuantity(quantity)}</strong> but only{' '}
                    <strong className="tabular-nums">{formatQuantity(preview.available)}</strong>{' '}
                    {preview.available === 1 ? 'unit is' : 'units are'} available.
                  </span>
                </p>
                <p className="mt-1.5 pl-[1.4rem] text-xs text-critical-700/80 dark:text-critical-300/80">
                  Inventory can never go negative, so this withdrawal would be refused.
                </p>
              </div>
            ) : preview && preview.allocations.length > 0 ? (
              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {preview.allocations.map((allocation, index) => (
                  <li key={allocation.batch_id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info-600 text-[0.625rem] font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-content-primary">
                        {allocation.batch_number}
                      </p>
                      <p className="mt-0.5 truncate text-[0.6875rem] text-content-tertiary">
                        Received {formatDate(allocation.received_at)}
                        {allocation.supplier ? ` · ${allocation.supplier}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums text-content-primary">
                        −{formatQuantity(allocation.quantity_taken)}
                        <span className="ml-1 font-normal text-content-tertiary">
                          of {formatQuantity(allocation.quantity_remaining)}
                        </span>
                      </p>
                      {allocation.depletes_batch ? (
                        <p className="mt-0.5 text-[0.625rem] font-medium text-caution-700 dark:text-caution-300">
                          depletes batch
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : !previewLoading ? (
              <p className="border-t border-border-subtle px-4 py-3 text-[0.8125rem] text-content-tertiary">
                No open batches — there is nothing to withdraw from.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reference" error={fieldErrors.reference} hint="Sales order, job number, transfer note.">
            <Input
              value={form.reference}
              onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
              placeholder="SO-5042"
              disabled={submitting}
            />
          </Field>

          <Field label="Issued at" error={fieldErrors.occurred_at}>
            <Input
              type="datetime-local"
              value={form.occurred_at}
              max={toLocalDateTimeValue(new Date())}
              onChange={(event) =>
                setForm((current) => ({ ...current, occurred_at: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>
        </div>

        <Field label="Notes" error={fieldErrors.notes}>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Anything worth recording about this withdrawal."
            rows={2}
            disabled={submitting}
          />
        </Field>
      </div>
    </Modal>
  );
}

function toLocalDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
