'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Switch, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { createSupplier, fetchProducts, updateSupplier } from '@/lib/data-source';
import { useSubmit } from '@/lib/use-async';
import type { Product, Supplier } from '@/types/api';
import { cn } from '@/lib/utils';

export interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
  onSaved: (supplier: Supplier) => void;
  /** Offer product linking. Hidden on edit-from-detail, which has its own panel. */
  allowProductLinks?: boolean;
}

export function SupplierFormModal({
  open,
  onClose,
  supplier,
  onSaved,
  allowProductLinks = true,
}: SupplierFormModalProps) {
  const toast = useToast();
  const isEditing = Boolean(supplier);

  const [form, setForm] = useState({
    name: '',
    code: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    default_lead_time_days: '',
    notes: '',
    is_active: true,
  });
  const [productIds, setProductIds] = useState<number[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(
    async (payload: Record<string, unknown>) =>
      isEditing && supplier ? updateSupplier(supplier.id, payload) : createSupplier(payload),
  );

  useEffect(() => {
    if (!open) return;

    reset();
    setProductSearch('');
    setForm({
      name: supplier?.name ?? '',
      code: supplier?.code ?? '',
      contact_name: supplier?.contact_name ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      website: supplier?.website ?? '',
      address_line1: supplier?.address.line1 ?? '',
      address_line2: supplier?.address.line2 ?? '',
      city: supplier?.address.city ?? '',
      state: supplier?.address.state ?? '',
      postal_code: supplier?.address.postal_code ?? '',
      country: supplier?.address.country ?? '',
      default_lead_time_days: supplier?.default_lead_time_days
        ? String(supplier.default_lead_time_days)
        : '',
      notes: supplier?.notes ?? '',
      is_active: supplier?.is_active ?? true,
    });
    setProductIds(supplier?.products?.map((product) => product.id) ?? []);
  }, [open, supplier, reset]);

  useEffect(() => {
    if (!open || !allowProductLinks) return;

    let cancelled = false;

    void fetchProducts({ per_page: 300 })
      .then((page) => {
        if (!cancelled) setProducts(page.data);
      })
      .catch(() => {
        /* product linking simply stays unavailable */
      });

    return () => {
      cancelled = true;
    };
  }, [open, allowProductLinks]);

  async function handleSubmit() {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase() || null,
      contact_name: form.contact_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim().toUpperCase() || null,
      default_lead_time_days: form.default_lead_time_days
        ? Number(form.default_lead_time_days)
        : null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };

    if (allowProductLinks) {
      payload.product_ids = productIds;
    }

    const saved = await submit(payload);

    if (saved) {
      toast.success(isEditing ? 'Supplier updated' : 'Supplier created', `${saved.name} saved.`);
      onSaved(saved);
      onClose();
    }
  }

  const visibleProducts = productSearch.trim()
    ? products.filter((product) =>
        `${product.name} ${product.sku}`.toLowerCase().includes(productSearch.trim().toLowerCase()),
      )
    : products.slice(0, 24);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit supplier' : 'New supplier'}
      description={
        isEditing
          ? 'Contact details and terms. Batches already received keep pointing at this supplier.'
          : 'Add a supplier you buy from. You can link the products they supply now or later.'
      }
      icon="truck"
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
            disabled={form.name.trim().length < 2}
            icon={isEditing ? 'check' : 'plus'}
          >
            {isEditing ? 'Save changes' : 'Create supplier'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pt-1">
        {error ? <Alert tone="critical">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Supplier name" required error={fieldErrors.name}>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Northwind Industrial"
              disabled={submitting}
            />
          </Field>

          <Field label="Code" error={fieldErrors.code} hint="Short reference.">
            <Input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="NWI"
              className="font-mono"
              disabled={submitting}
            />
          </Field>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold tracking-wide text-content-tertiary uppercase">
            Contact
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" error={fieldErrors.contact_name}>
              <Input
                value={form.contact_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contact_name: event.target.value }))
                }
                placeholder="Accounts team"
                disabled={submitting}
              />
            </Field>

            <Field label="Email" error={fieldErrors.email}>
              <Input
                type="email"
                icon="mail"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="orders@supplier.com"
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" error={fieldErrors.phone}>
              <Input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+1-555-0100"
                disabled={submitting}
              />
            </Field>

            <Field label="Website" error={fieldErrors.website} hint="Include https://">
              <Input
                type="url"
                value={form.website}
                onChange={(event) =>
                  setForm((current) => ({ ...current, website: event.target.value }))
                }
                placeholder="https://supplier.com"
                disabled={submitting}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold tracking-wide text-content-tertiary uppercase">
            Address
          </legend>

          <Field label="Address line 1" error={fieldErrors.address_line1}>
            <Input
              value={form.address_line1}
              onChange={(event) =>
                setForm((current) => ({ ...current, address_line1: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>

          <Field label="Address line 2" error={fieldErrors.address_line2}>
            <Input
              value={form.address_line2}
              onChange={(event) =>
                setForm((current) => ({ ...current, address_line2: event.target.value }))
              }
              disabled={submitting}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="City" error={fieldErrors.city}>
              <Input
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                disabled={submitting}
              />
            </Field>
            <Field label="State" error={fieldErrors.state}>
              <Input
                value={form.state}
                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                disabled={submitting}
              />
            </Field>
            <Field label="Postal code" error={fieldErrors.postal_code}>
              <Input
                value={form.postal_code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, postal_code: event.target.value }))
                }
                disabled={submitting}
              />
            </Field>
            <Field label="Country" error={fieldErrors.country} hint="Two letters.">
              <Input
                value={form.country}
                maxLength={2}
                onChange={(event) =>
                  setForm((current) => ({ ...current, country: event.target.value }))
                }
                placeholder="US"
                className="uppercase"
                disabled={submitting}
              />
            </Field>
          </div>
        </fieldset>

        <Field
          label="Default lead time"
          error={fieldErrors.default_lead_time_days}
          hint="Days from order to delivery, as a starting point for reorder planning."
        >
          <Input
            type="number"
            min={0}
            value={form.default_lead_time_days}
            onChange={(event) =>
              setForm((current) => ({ ...current, default_lead_time_days: event.target.value }))
            }
            placeholder="7"
            suffix="days"
            disabled={submitting}
          />
        </Field>

        <Field label="Notes" error={fieldErrors.notes}>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Payment terms, reliability, anything your team should know."
            rows={2}
            disabled={submitting}
          />
        </Field>

        {allowProductLinks ? (
          <Field
            label="Products supplied"
            error={fieldErrors['product_ids.0']}
            hint={`${productIds.length} selected. A product can have several suppliers.`}
          >
            <div className="space-y-2">
              <Input
                icon="search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Filter products…"
                disabled={submitting}
                size="sm"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg bg-surface-sunken/50 p-2 ring-1 ring-border-subtle ring-inset">
                {visibleProducts.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-content-tertiary">
                    {products.length === 0 ? 'No products yet.' : 'No products match.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {visibleProducts.map((product) => {
                      const selected = productIds.includes(product.id);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setProductIds((current) =>
                              selected
                                ? current.filter((id) => id !== product.id)
                                : [...current, product.id],
                            )
                          }
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                            selected
                              ? 'bg-brand-600 text-white ring-brand-700'
                              : 'bg-surface-card text-content-secondary ring-border-default hover:ring-border-strong',
                          )}
                          disabled={submitting}
                        >
                          {product.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {!productSearch && products.length > 24 ? (
                <p className="text-xs text-content-tertiary">
                  Showing the first 24 — search to find others.
                </p>
              ) : null}
            </div>
          </Field>
        ) : null}

        <div className="border-t border-border-subtle pt-4">
          <Switch
            checked={form.is_active}
            onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
            label="Active"
            description="Inactive suppliers are hidden from the stock-in form but keep their history."
            disabled={submitting}
          />
        </div>
      </div>
    </Modal>
  );
}
