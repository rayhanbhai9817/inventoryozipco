'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, RadioCardGroup, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { fetchProducts, recordAdjustment } from '@/lib/data-source';
import { formatQuantity } from '@/lib/format';
import { useSubmit } from '@/lib/use-async';
import type { Product } from '@/types/api';
import { cn } from '@/lib/utils';

const INCREASE_REASONS = [
  'Found during stock count',
  'Returned from customer',
  'Correcting an under-count',
  'Received without paperwork',
];

const DECREASE_REASONS = [
  'Damaged during handling',
  'Lost or shrinkage',
  'Expired or spoiled',
  'Correcting an over-count',
  'Written off',
];

/**
 * Record an inventory adjustment.
 *
 * A reason is mandatory, because an unexplained adjustment is the one thing a
 * stock audit can never reconstruct afterwards. The backend enforces this too.
 *
 * A decrease consumes batches FIFO and is subject to the same non-negative
 * guarantee as a withdrawal; an increase opens a new batch dated now, which puts
 * it at the end of the FIFO queue.
 */
export interface AdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
  initialProductId?: number | null;
}

export function AdjustmentModal({
  open,
  onClose,
  onRecorded,
  initialProductId,
}: AdjustmentModalProps) {
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [direction, setDirection] = useState<'increase' | 'decrease'>('decrease');
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    reason: '',
    customReason: '',
    reference: '',
    notes: '',
  });

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(recordAdjustment);

  useEffect(() => {
    if (!open) return;

    reset();
    setDirection('decrease');
    setForm({
      product_id: initialProductId ? String(initialProductId) : '',
      quantity: '',
      reason: '',
      customReason: '',
      reference: '',
      notes: '',
    });
  }, [open, initialProductId, reset]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void fetchProducts({ per_page: 300 })
      .then((page) => {
        if (!cancelled) setProducts(page.data.filter((product) => !product.is_archived));
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

  const magnitude = Number(form.quantity || 0);
  const delta = direction === 'increase' ? magnitude : -magnitude;
  const balanceAfter = selectedProduct ? selectedProduct.quantity_on_hand + delta : null;
  const wouldGoNegative = balanceAfter !== null && balanceAfter < 0;

  const reasonOptions = direction === 'increase' ? INCREASE_REASONS : DECREASE_REASONS;
  const effectiveReason = form.reason === '__custom' ? form.customReason.trim() : form.reason;

  async function handleSubmit() {
    const movement = await submit({
      product_id: Number(form.product_id),
      quantity_delta: delta,
      reason: effectiveReason,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    });

    if (movement) {
      toast.success(
        'Adjustment recorded',
        `${selectedProduct?.name ?? 'Product'} adjusted by ${delta > 0 ? '+' : '−'}${magnitude}. Balance is now ${formatQuantity(movement.balance_after)}.`,
      );
      onRecorded();
      onClose();
    }
  }

  const canSubmit =
    Boolean(form.product_id) &&
    magnitude > 0 &&
    effectiveReason.length >= 3 &&
    !wouldGoNegative;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust inventory"
      description="Correct a quantity after a stock count, damage or loss. The adjustment is recorded in the ledger like any other movement."
      icon="sliders"
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit} icon="sliders">
            Record adjustment
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

        <Field label="Direction" required>
          <RadioCardGroup
            name="adjustment-direction"
            value={direction}
            onChange={(value) => {
              setDirection(value);
              // The reason lists differ per direction, so clear the stale choice.
              setForm((current) => ({ ...current, reason: '', customReason: '' }));
            }}
            options={[
              {
                value: 'decrease',
                label: 'Decrease',
                description: 'Consumes batches oldest first, like a withdrawal.',
                icon: 'minus',
              },
              {
                value: 'increase',
                label: 'Increase',
                description: 'Opens a new batch dated now, at the end of the FIFO queue.',
                icon: 'plus',
              },
            ]}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quantity"
            required
            error={fieldErrors.quantity_delta}
            hint={
              selectedProduct
                ? `${formatQuantity(selectedProduct.quantity_on_hand)} ${selectedProduct.unit.abbreviation} currently on hand`
                : undefined
            }
          >
            <Input
              type="number"
              min={1}
              step={1}
              max={direction === 'decrease' ? selectedProduct?.quantity_on_hand : undefined}
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="0"
              suffix={selectedProduct?.unit.abbreviation}
              invalid={wouldGoNegative}
              disabled={submitting}
              size="lg"
            />
          </Field>

          <Field label="Reference" error={fieldErrors.reference} hint="Stock count sheet, incident number.">
            <Input
              value={form.reference}
              onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
              placeholder="Optional"
              disabled={submitting}
              size="lg"
            />
          </Field>
        </div>

        {/* Before/after, and a hard stop if it would go below zero. */}
        {selectedProduct && magnitude > 0 ? (
          <div
            className={cn(
              'flex items-center gap-4 rounded-xl p-4 ring-1 ring-inset',
              wouldGoNegative
                ? 'bg-critical-50 ring-critical-500/25 dark:bg-critical-700/10'
                : 'bg-surface-sunken/70 ring-border-subtle',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
                Current
              </p>
              <p className="mt-1 font-display text-xl leading-none font-semibold tabular-nums text-content-primary">
                {formatQuantity(selectedProduct.quantity_on_hand)}
              </p>
            </div>

            <Icon name="arrow-right" size={18} className="shrink-0 text-content-tertiary" />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-content-tertiary uppercase">
                After adjustment
              </p>
              <p
                className={cn(
                  'mt-1 font-display text-xl leading-none font-semibold tabular-nums',
                  wouldGoNegative
                    ? 'text-critical-700 dark:text-critical-300'
                    : direction === 'increase'
                      ? 'text-positive-700 dark:text-positive-300'
                      : 'text-content-primary',
                )}
              >
                {formatQuantity(balanceAfter)}
              </p>
            </div>

            {wouldGoNegative ? (
              <p className="max-w-[14rem] shrink-0 text-xs leading-relaxed text-critical-700 dark:text-critical-300">
                Inventory can never go negative — reduce the quantity.
              </p>
            ) : null}
          </div>
        ) : null}

        <Field
          label="Reason"
          required
          error={fieldErrors.reason}
          hint="Required. An unexplained adjustment cannot be reconstructed in a stock audit."
        >
          <Select
            value={form.reason}
            placeholder="Choose a reason…"
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            disabled={submitting}
            size="lg"
          >
            <option value="">Choose a reason…</option>
            {reasonOptions.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
            <option value="__custom">Something else…</option>
          </Select>
        </Field>

        {form.reason === '__custom' ? (
          <Field label="Describe the reason" required>
            <Input
              value={form.customReason}
              onChange={(event) =>
                setForm((current) => ({ ...current, customReason: event.target.value }))
              }
              placeholder="At least a few words"
              disabled={submitting}
              autoFocus
            />
          </Field>
        ) : null}

        <Field label="Notes" error={fieldErrors.notes}>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Further detail for whoever reads this in six months."
            rows={2}
            disabled={submitting}
          />
        </Field>
      </div>
    </Modal>
  );
}
