'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon, type IconName } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/button';
import { StockStatusBadge } from '@/components/ui/badge';
import { fetchProducts, fetchSuppliers } from '@/lib/data-source';
import { NAVIGATION } from '@/lib/navigation';
import { formatQuantity } from '@/lib/format';
import { cn, lockBodyScroll, trapFocus } from '@/lib/utils';
import type { PermissionKey, Product, Supplier } from '@/types/api';

/**
 * Command palette, opened with ⌘K.
 *
 * Searches products and suppliers through the same debounced API the list pages
 * use, and also matches navigation destinations so "ledger" jumps straight there.
 * Results are grouped, and Arrow/Enter works throughout — a palette that needs the
 * mouse defeats the point.
 */

interface SearchResult {
  id: string;
  group: 'Products' | 'Suppliers' | 'Go to';
  label: string;
  detail?: string;
  icon: IconName;
  href: string;
  trailing?: React.ReactNode;
}

export interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
  permissions: PermissionKey[] | undefined;
}

export function GlobalSearch({ open, onClose, onNavigate, permissions }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const held = useMemo(() => new Set(permissions ?? []), [permissions]);
  const canSeeProducts = held.has('products.view');
  const canSeeSuppliers = held.has('suppliers.view');

  // Reset when the palette closes, so reopening is always a clean slate.
  useEffect(() => {
    if (open) return;

    setQuery('');
    setProducts([]);
    setSuppliers([]);
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const releaseScroll = lockBodyScroll();
    const panel = panelRef.current;
    const releaseFocus = panel ? trapFocus(panel) : () => {};

    inputRef.current?.focus();

    return () => {
      releaseScroll();
      releaseFocus();
    };
  }, [open]);

  // Debounced fetch. Two requests in parallel rather than sequentially, since
  // neither depends on the other.
  useEffect(() => {
    if (!open) return;

    const term = query.trim();

    if (term.length < 2) {
      setProducts([]);
      setSuppliers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const [productPage, supplierPage] = await Promise.all([
          canSeeProducts
            ? fetchProducts({ search: term, per_page: 5 })
            : Promise.resolve({ data: [] as Product[] }),
          canSeeSuppliers
            ? fetchSuppliers({ search: term, per_page: 4, include_inactive: true })
            : Promise.resolve({ data: [] as Supplier[] }),
        ]);

        if (cancelled) return;

        setProducts(productPage.data);
        setSuppliers(supplierPage.data);
      } catch {
        if (!cancelled) {
          setProducts([]);
          setSuppliers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, canSeeProducts, canSeeSuppliers]);

  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLowerCase();

    const navResults: SearchResult[] = NAVIGATION.flatMap((section) => section.items)
      .filter(
        (item) =>
          item.permissions.some((permission) => held.has(permission)) &&
          (term.length === 0 || item.label.toLowerCase().includes(term)),
      )
      .slice(0, term.length === 0 ? 6 : 4)
      .map((item) => ({
        id: `nav-${item.href}`,
        group: 'Go to',
        label: item.label,
        icon: item.icon,
        href: item.href,
      }));

    const productResults: SearchResult[] = products.map((product) => ({
      id: `product-${product.id}`,
      group: 'Products',
      label: product.name,
      detail: `${product.sku} · ${formatQuantity(product.quantity_on_hand)} ${product.unit.abbreviation} on hand`,
      icon: 'package',
      href: `/products/${product.id}`,
      trailing: <StockStatusBadge status={product.stock_status.value} label={product.stock_status.label} />,
    }));

    const supplierResults: SearchResult[] = suppliers.map((supplier) => ({
      id: `supplier-${supplier.id}`,
      group: 'Suppliers',
      label: supplier.name,
      detail: [supplier.code, supplier.contact_name].filter(Boolean).join(' · ') || undefined,
      icon: 'truck',
      href: `/suppliers/${supplier.id}`,
    }));

    return [...productResults, ...supplierResults, ...navResults];
  }, [products, suppliers, query, held]);

  // Keep the highlight inside the result list as it changes length.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Scroll the highlighted row into view for keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!mounted || !open) return null;

  const grouped = results.reduce<Record<string, Array<{ result: SearchResult; index: number }>>>(
    (groups, result, index) => {
      (groups[result.group] ??= []).push({ result, index });
      return groups;
    },
    {},
  );

  function handleKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) =>
          results.length ? (current - 1 + results.length) % results.length : 0,
        );
        break;
      case 'Enter': {
        event.preventDefault();
        const selected = results[activeIndex];
        if (selected) onNavigate(selected.href);
        break;
      }
      default:
        break;
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 sm:pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={handleKeyDown}
        className="relative flex max-h-[70dvh] w-full max-w-xl animate-scale-in flex-col overflow-hidden rounded-2xl bg-surface-card shadow-2xl ring-1 ring-border-subtle"
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <Icon name="search" size={18} className="shrink-0 text-content-tertiary" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls="global-search-results"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, suppliers, or jump to a page…"
            className="flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none"
          />
          {loading ? <Spinner size={15} className="text-brand-500" /> : null}
          <kbd className="hidden shrink-0 rounded border border-border-default bg-surface-sunken px-1.5 py-0.5 font-sans text-[0.625rem] font-medium text-content-tertiary sm:inline-block">
            Esc
          </kbd>
        </div>

        <div
          ref={listRef}
          id="global-search-results"
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <Icon name="search" size={22} className="mx-auto text-content-tertiary" />
              <p className="mt-3 text-[0.8125rem] font-medium text-content-primary">
                {query.trim().length < 2 ? 'Start typing to search' : 'No matches'}
              </p>
              <p className="mt-1 text-xs text-content-tertiary">
                {query.trim().length < 2
                  ? 'Products and suppliers by name, SKU or code.'
                  : 'Try a different name, SKU or supplier code.'}
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([group, entries]) => (
              <div key={group} className="mb-1 last:mb-0">
                <p className="px-2.5 py-1.5 text-[0.6875rem] font-semibold tracking-wider text-content-tertiary uppercase">
                  {group}
                </p>
                <ul>
                  {entries.map(({ result, index }) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => onNavigate(result.href)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                          index === activeIndex
                            ? 'bg-brand-50 dark:bg-brand-950'
                            : 'hover:bg-ink-100 dark:hover:bg-surface-raised',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            index === activeIndex
                              ? 'bg-brand-600 text-white'
                              : 'bg-surface-sunken text-content-secondary',
                          )}
                        >
                          <Icon name={result.icon} size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-content-primary">
                            {result.label}
                          </span>
                          {result.detail ? (
                            <span className="block truncate text-xs text-content-tertiary">
                              {result.detail}
                            </span>
                          ) : null}
                        </span>
                        {result.trailing ? <span className="shrink-0">{result.trailing}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 border-t border-border-subtle bg-surface-sunken/50 px-4 py-2 text-[0.6875rem] text-content-tertiary">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border-default bg-surface-card px-1 font-sans">↑</kbd>
            <kbd className="rounded border border-border-default bg-surface-card px-1 font-sans">↓</kbd>
            to navigate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border-default bg-surface-card px-1 font-sans">↵</kbd>
            to open
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
