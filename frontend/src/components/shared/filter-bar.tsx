'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { SearchInput } from '@/components/ui/search-input';
import { fetchCategories, fetchProducts, fetchSuppliers } from '@/lib/data-source';
import type { ListFilters } from '@/types/api';
import { cn } from '@/lib/utils';

/* ==========================================================================
   FilterBar

   One filter surface for every list and report, so the controls sit in the same
   place and behave the same way throughout the product.

   Each filter is opt-in, because a page should only offer filters that apply to
   it. Active filters are summarised as removable chips below the bar — otherwise
   a filter set two scrolls up silently changes what a table means.
   ========================================================================== */

export type FilterKey =
  | 'search'
  | 'dates'
  | 'category'
  | 'supplier'
  | 'product'
  | 'movementType'
  | 'stockStatus'
  | 'includeArchived'
  | 'includeInactive'
  | 'includeDepleted';

export interface FilterBarProps {
  filters: ListFilters;
  onChange: (filters: ListFilters) => void;
  /** Which filters this page offers, in the order they should appear. */
  enabled: FilterKey[];
  searchPlaceholder?: string;
  /** Extra controls on the right — an export button, a view toggle. */
  actions?: ReactNode;
  /** Shown while the list is refetching, so the search box can spin. */
  loading?: boolean;
  className?: string;
}

interface Option {
  value: number;
  label: string;
}

export function FilterBar({
  filters,
  onChange,
  enabled,
  searchPlaceholder = 'Search…',
  actions,
  loading = false,
  className,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);

  const needsCategories = enabled.includes('category');
  const needsSuppliers = enabled.includes('supplier');
  const needsProducts = enabled.includes('product');

  // Load the option lists once. They are small, change rarely, and loading them
  // lazily per dropdown would make the filters feel sluggish.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [categoryPage, supplierPage, productPage] = await Promise.all([
        needsCategories ? fetchCategories({ per_page: 200 }) : null,
        needsSuppliers ? fetchSuppliers({ per_page: 200, include_inactive: true }) : null,
        needsProducts ? fetchProducts({ per_page: 200, include_archived: true }) : null,
      ]);

      if (cancelled) return;

      if (categoryPage) {
        setCategories(categoryPage.data.map((row) => ({ value: row.id, label: row.name })));
      }

      if (supplierPage) {
        setSuppliers(supplierPage.data.map((row) => ({ value: row.id, label: row.name })));
      }

      if (productPage) {
        setProducts(
          productPage.data.map((row) => ({ value: row.id, label: `${row.name} — ${row.sku}` })),
        );
      }
    }

    void load().catch(() => {
      // A failed option list must not break the page; the filter simply stays
      // empty and the list still works unfiltered.
    });

    return () => {
      cancelled = true;
    };
  }, [needsCategories, needsSuppliers, needsProducts]);

  /** Patch the filter set and reset to page 1 — a filtered page 7 is meaningless. */
  function patch(changes: Partial<ListFilters>) {
    onChange({ ...filters, ...changes, page: 1 });
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: keyof ListFilters; label: string }> = [];

    if (filters.date_from || filters.date_to) {
      chips.push({
        key: 'date_from',
        label: `${filters.date_from ?? 'any'} → ${filters.date_to ?? 'today'}`,
      });
    }

    if (filters.category_id) {
      const match = categories.find((option) => option.value === filters.category_id);
      chips.push({ key: 'category_id', label: `Category: ${match?.label ?? filters.category_id}` });
    }

    if (filters.supplier_id) {
      const match = suppliers.find((option) => option.value === filters.supplier_id);
      chips.push({ key: 'supplier_id', label: `Supplier: ${match?.label ?? filters.supplier_id}` });
    }

    if (filters.product_id) {
      const match = products.find((option) => option.value === filters.product_id);
      chips.push({ key: 'product_id', label: `Product: ${match?.label ?? filters.product_id}` });
    }

    if (filters.type) {
      chips.push({ key: 'type', label: `Type: ${filters.type.replace('_', ' ')}` });
    }

    if (filters.stock_status) {
      chips.push({ key: 'stock_status', label: `Status: ${filters.stock_status.replace(/_/g, ' ')}` });
    }

    if (filters.include_archived) chips.push({ key: 'include_archived', label: 'Including archived' });
    if (filters.include_inactive) chips.push({ key: 'include_inactive', label: 'Including inactive' });
    if (filters.include_depleted) chips.push({ key: 'include_depleted', label: 'Including depleted' });

    return chips;
  }, [filters, categories, suppliers, products]);

  const advancedFilters = enabled.filter((key) => key !== 'search');
  const hasAdvanced = advancedFilters.length > 0;

  function clearAll() {
    onChange({ search: filters.search, per_page: filters.per_page, page: 1 });
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {enabled.includes('search') ? (
          <SearchInput
            value={filters.search ?? ''}
            onChange={(value) => patch({ search: value || undefined })}
            placeholder={searchPlaceholder}
            loading={loading}
            className="min-w-0 flex-1 sm:max-w-sm"
          />
        ) : null}

        {hasAdvanced ? (
          <Button
            variant={activeChips.length > 0 ? 'subtle' : 'secondary'}
            size="md"
            icon="filter"
            trailingIcon={expanded ? 'chevron-up' : 'chevron-down'}
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            Filters
            {activeChips.length > 0 ? (
              <span className="ml-0.5 rounded-full bg-brand-600 px-1.5 text-[0.625rem] font-bold text-white tabular-nums">
                {activeChips.length}
              </span>
            ) : null}
          </Button>
        ) : null}

        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>

      {/* ---------- Expanded filter panel ---------- */}
      {expanded && hasAdvanced ? (
        <div className="animate-fade-in rounded-xl bg-surface-card p-4 ring-1 ring-border-subtle">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {enabled.includes('dates') ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.8125rem] font-medium text-content-primary">From</span>
                  <input
                    type="date"
                    value={filters.date_from ?? ''}
                    max={filters.date_to ?? undefined}
                    onChange={(event) => patch({ date_from: event.target.value || undefined })}
                    className="h-10 rounded-lg bg-surface-card px-3 text-sm text-content-primary ring-1 ring-border-default ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.8125rem] font-medium text-content-primary">To</span>
                  <input
                    type="date"
                    value={filters.date_to ?? ''}
                    min={filters.date_from ?? undefined}
                    onChange={(event) => patch({ date_to: event.target.value || undefined })}
                    className="h-10 rounded-lg bg-surface-card px-3 text-sm text-content-primary ring-1 ring-border-default ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </label>
              </>
            ) : null}

            {enabled.includes('category') ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium text-content-primary">Category</span>
                <Select
                  value={filters.category_id ?? ''}
                  placeholder="All categories"
                  options={categories}
                  onChange={(event) =>
                    patch({ category_id: event.target.value ? Number(event.target.value) : undefined })
                  }
                />
              </label>
            ) : null}

            {enabled.includes('supplier') ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium text-content-primary">Supplier</span>
                <Select
                  value={filters.supplier_id ?? ''}
                  placeholder="All suppliers"
                  options={suppliers}
                  onChange={(event) =>
                    patch({ supplier_id: event.target.value ? Number(event.target.value) : undefined })
                  }
                />
              </label>
            ) : null}

            {enabled.includes('product') ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium text-content-primary">Product</span>
                <Select
                  value={filters.product_id ?? ''}
                  placeholder="All products"
                  options={products}
                  onChange={(event) =>
                    patch({ product_id: event.target.value ? Number(event.target.value) : undefined })
                  }
                />
              </label>
            ) : null}

            {enabled.includes('movementType') ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium text-content-primary">
                  Movement type
                </span>
                <Select
                  value={filters.type ?? ''}
                  placeholder="All types"
                  options={[
                    { value: 'stock_in', label: 'Stock in' },
                    { value: 'stock_out', label: 'Stock out' },
                    { value: 'adjustment', label: 'Adjustment' },
                  ]}
                  onChange={(event) =>
                    patch({ type: (event.target.value || undefined) as ListFilters['type'] })
                  }
                />
              </label>
            ) : null}

            {enabled.includes('stockStatus') ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-medium text-content-primary">
                  Stock status
                </span>
                <Select
                  value={filters.stock_status ?? ''}
                  placeholder="Any status"
                  options={[
                    { value: 'in_stock', label: 'In stock' },
                    { value: 'low_stock', label: 'Low stock' },
                    { value: 'out_of_stock', label: 'Out of stock' },
                  ]}
                  onChange={(event) =>
                    patch({
                      stock_status: (event.target.value || undefined) as ListFilters['stock_status'],
                    })
                  }
                />
              </label>
            ) : null}
          </div>

          {/* Inclusion toggles */}
          {enabled.some((key) =>
            ['includeArchived', 'includeInactive', 'includeDepleted'].includes(key),
          ) ? (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-border-subtle pt-4">
              {enabled.includes('includeArchived') ? (
                <ToggleFilter
                  label="Include archived products"
                  checked={Boolean(filters.include_archived)}
                  onChange={(checked) => patch({ include_archived: checked || undefined })}
                />
              ) : null}
              {enabled.includes('includeInactive') ? (
                <ToggleFilter
                  label="Include inactive"
                  checked={Boolean(filters.include_inactive)}
                  onChange={(checked) => patch({ include_inactive: checked || undefined })}
                />
              ) : null}
              {enabled.includes('includeDepleted') ? (
                <ToggleFilter
                  label="Include depleted batches"
                  checked={Boolean(filters.include_depleted)}
                  onChange={(checked) => patch({ include_depleted: checked || undefined })}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---------- Active filter chips ---------- */}
      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-content-tertiary">Filtered by</span>
          {activeChips.map((chip) => (
            <button
              key={String(chip.key)}
              type="button"
              onClick={() => {
                const next = { ...filters, page: 1 };

                if (chip.key === 'date_from') {
                  delete next.date_from;
                  delete next.date_to;
                } else {
                  delete next[chip.key];
                }

                onChange(next);
              }}
              className="group"
            >
              <Badge tone="brand" className="gap-1 pr-1.5 transition-colors group-hover:bg-brand-100 dark:group-hover:bg-brand-900">
                {chip.label}
                <Icon name="x" size={11} className="opacity-60 group-hover:opacity-100" />
              </Badge>
            </button>
          ))}
          <Button variant="ghost" size="xs" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ToggleFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] text-content-secondary select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 cursor-pointer appearance-none rounded bg-surface-card ring-1 ring-border-default ring-inset checked:bg-brand-600 checked:ring-brand-600"
      />
      {label}
    </label>
  );
}
