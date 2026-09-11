'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { createProduct, fetchCategories, fetchSuppliers, updateProduct } from '@/lib/data-source';
import { useSubmit } from '@/lib/use-async';
import type { Category, Product, Supplier } from '@/types/api';
import { cn } from '@/lib/utils';

/**
 * Create / edit a product.
 *
 * Note what is *not* here: a quantity field. Quantity only ever changes through a
 * stock movement, so offering it on a product form would imply a capability the
 * backend correctly refuses.
 */

const UNITS = [
  { value: 'each', label: 'Each (ea)' },
  { value: 'box', label: 'Box' },
  { value: 'case', label: 'Case' },
  { value: 'pack', label: 'Pack' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'gram', label: 'Gram (g)' },
  { value: 'kilogram', label: 'Kilogram (kg)' },
  { value: 'litre', label: 'Litre (L)' },
  { value: 'millilitre', label: 'Millilitre (mL)' },
  { value: 'metre', label: 'Metre (m)' },
];

export interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Omit to create. */
  product?: Product | null;
  onSaved: (product: Product) => void;
}

export function ProductFormModal({ open, onClose, product, onSaved }: ProductFormModalProps) {
  const toast = useToast();
  const isEditing = Boolean(product);

  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    barcode: '',
    category_id: '',
    unit: 'each',
    minimum_stock_level: '0',
    reorder_quantity: '',
    is_active: true,
  });
  const [supplierIds, setSupplierIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(
    async (payload: Record<string, unknown>, ids: number[]) =>
      isEditing && product
        ? updateProduct(product.id, payload)
        : createProduct({ ...payload, supplier_ids: ids }),
  );

  // Seed the form whenever the modal opens, so reopening after a cancel does not
  // show the previous edit.
  useEffect(() => {
    if (!open) return;

    reset();

    setForm({
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      description: product?.description ?? '',
      barcode: product?.barcode ?? '',
      category_id: product?.category?.id ? String(product.category.id) : '',
      unit: product?.unit.value ?? 'each',
      minimum_stock_level: String(product?.minimum_stock_level ?? 0),
      reorder_quantity: product?.reorder_quantity ? String(product.reorder_quantity) : '',
      is_active: product?.is_active ?? true,
    });

    setSupplierIds(product?.suppliers?.map((supplier) => supplier.id) ?? []);
  }, [open, product, reset]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void Promise.all([
      fetchCategories({ per_page: 200 }),
      fetchSuppliers({ per_page: 200, include_inactive: true }),
    ])
      .then(([categoryPage, supplierPage]) => {
        if (cancelled) return;

        setCategories(categoryPage.data);
        setSuppliers(supplierPage.data);
      })
      .catch(() => {
        /* the form still works without the option lists */
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSubmit() {
    const payload: Record<string, unknown> = {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      barcode: form.barcode.trim() || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      unit: form.unit,
      minimum_stock_level: Number(form.minimum_stock_level || 0),
      reorder_quantity: form.reorder_quantity ? Number(form.reorder_quantity) : null,
      is_active: form.is_active,
    };

    const saved = await submit(payload, supplierIds);

    if (saved) {
      toast.success(
        isEditing ? 'Product updated' : 'Product created',
        `${saved.name} (${saved.sku}) has been saved.`,
      );
      onSaved(saved);
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit product' : 'New product'}
      description={
        isEditing
          ? 'Changes apply immediately. Quantity on hand can only change through a stock movement.'
          : 'Add an item to your catalogue. You will record its stock separately.'
      }
      icon="package"
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} icon={isEditing ? 'check' : 'plus'}>
            {isEditing ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pt-1">
        {error ? <Alert tone="critical">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="SKU"
            required
            error={fieldErrors.sku}
            hint="Unique within your business."
          >
            <Input
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
              placeholder="FS-DRL-1801"
              className="font-mono"
              disabled={submitting}
            />
          </Field>

          <Field label="Barcode" error={fieldErrors.barcode}>
            <Input
              value={form.barcode}
              onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
              placeholder="Optional"
              className="font-mono"
              disabled={submitting}
            />
          </Field>
        </div>

        <Field label="Product name" required error={fieldErrors.name}>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="18V Brushless Drill Driver"
            disabled={submitting}
          />
        </Field>

        <Field label="Description" error={fieldErrors.description}>
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="What it is, and anything your team should know when picking it."
            rows={3}
            disabled={submitting}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" error={fieldErrors.category_id}>
            <Select
              value={form.category_id}
              placeholder="Uncategorised"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              onChange={(event) =>
                setForm((current) => ({ ...current, category_id: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>

          <Field
            label="Unit of measure"
            required
            error={fieldErrors.unit}
            hint="Quantities are whole numbers of this unit."
          >
            <Select
              value={form.unit}
              options={UNITS}
              onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
              disabled={submitting}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Minimum stock level"
            error={fieldErrors.minimum_stock_level}
            hint="Triggers a low-stock alert at or below this."
          >
            <Input
              type="number"
              min={0}
              value={form.minimum_stock_level}
              onChange={(event) =>
                setForm((current) => ({ ...current, minimum_stock_level: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>

          <Field
            label="Reorder quantity"
            error={fieldErrors.reorder_quantity}
            hint="How much you usually order at a time."
          >
            <Input
              type="number"
              min={0}
              value={form.reorder_quantity}
              onChange={(event) =>
                setForm((current) => ({ ...current, reorder_quantity: event.target.value }))
              }
              placeholder="Optional"
              disabled={submitting}
            />
          </Field>
        </div>

        {/* Supplier links are only offered on create; on edit they are managed
            from the product detail page, where the pivot detail is visible. */}
        {!isEditing ? (
          <Field
            label="Suppliers"
            error={fieldErrors['supplier_ids.0']}
            hint="Link the suppliers you buy this from. You can change this later."
          >
            <div className="flex flex-wrap gap-2">
              {suppliers.length === 0 ? (
                <p className="text-[0.8125rem] text-content-tertiary">
                  No suppliers yet — you can add them later.
                </p>
              ) : (
                suppliers.map((supplier) => {
                  const selected = supplierIds.includes(supplier.id);

                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSupplierIds((current) =>
                          selected
                            ? current.filter((id) => id !== supplier.id)
                            : [...current, supplier.id],
                        )
                      }
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[0.8125rem] font-medium ring-1 ring-inset transition-colors',
                        selected
                          ? 'bg-brand-600 text-white ring-brand-700'
                          : 'bg-surface-card text-content-secondary ring-border-default hover:ring-border-strong',
                      )}
                      disabled={submitting}
                    >
                      {supplier.name}
                    </button>
                  );
                })
              )}
            </div>
          </Field>
        ) : null}

        <div className="border-t border-border-subtle pt-4">
          <Switch
            checked={form.is_active}
            onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
            label="Active"
            description="Inactive products are hidden from pickers and cannot take new movements."
            disabled={submitting}
          />
        </div>
      </div>
    </Modal>
  );
}
