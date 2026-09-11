'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/* ==========================================================================
   DataTable

   One table component for every list in the product, built around a column
   definition so each screen declares *what* to show rather than re-implementing
   markup, sorting affordances and responsive behaviour.

   Responsive strategy: below `md` the table is replaced by a stacked card list
   built from the same column definitions (`mobileLabel` / `primary` decide what
   leads each card). Shrinking a wide table until it is unusable is not
   responsive design, so the data is genuinely re-laid out instead.
   ========================================================================== */

export interface Column<T> {
  /** Stable key — also used as the React key. */
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Sort key sent to the API. Omit to make the column unsortable. */
  sortKey?: string;
  align?: 'left' | 'right' | 'center';
  /** Tailwind width class, e.g. `w-32`. */
  width?: string;
  /** Hide below `lg`, for columns that matter less on small screens. */
  hideBelowLg?: boolean;
  /** On mobile cards this column is the headline. Exactly one should set it. */
  primary?: boolean;
  /** Label shown beside the value on mobile cards. Defaults to `header`. */
  mobileLabel?: string;
  /** Exclude from mobile cards entirely (e.g. a row-actions column). */
  hideOnMobile?: boolean;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Makes rows clickable — used to open a detail page. */
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Shown instead of rows when `rows` is empty and not loading. */
  empty?: ReactNode;
  loading?: boolean;
  /** Skeleton row count while loading. */
  skeletonRows?: number;
  /** Right-aligned actions rendered per row on mobile cards. */
  mobileActions?: (row: T) => ReactNode;
  className?: string;
  /** Compact row height for dense data like the ledger. */
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  empty,
  loading = false,
  skeletonRows = 6,
  mobileActions,
  className,
  dense = false,
}: DataTableProps<T>) {
  const alignClass = (align: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  function handleSort(column: Column<T>) {
    if (!column.sortKey || !onSortChange) return;

    const isActive = sort?.key === column.sortKey;
    onSortChange({
      key: column.sortKey,
      direction: isActive && sort?.direction === 'asc' ? 'desc' : 'asc',
    });
  }

  if (loading) {
    return <TableSkeleton columns={columns.length} rows={skeletonRows} className={className} />;
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const mobileColumns = columns.filter((column) => !column.hideOnMobile);
  const primaryColumn = mobileColumns.find((column) => column.primary) ?? mobileColumns[0];
  const secondaryColumns = mobileColumns.filter((column) => column !== primaryColumn);

  return (
    <div className={className}>
      {/* ---------- Desktop: a real table ---------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {columns.map((column) => {
                const isSorted = sort?.key === column.sortKey;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'bg-surface-sunken/50 px-4 py-2.5 text-xs font-semibold tracking-wide text-content-tertiary uppercase',
                      alignClass(column.align),
                      column.width,
                      column.hideBelowLg && 'hidden lg:table-cell',
                    )}
                  >
                    {column.sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-content-primary',
                          column.align === 'right' && 'flex-row-reverse',
                          isSorted && 'text-content-primary',
                        )}
                      >
                        {column.header}
                        <Icon
                          name={
                            isSorted
                              ? sort?.direction === 'asc'
                                ? 'chevron-up'
                                : 'chevron-down'
                              : 'chevron-down'
                          }
                          size={13}
                          className={cn('transition-opacity', !isSorted && 'opacity-35')}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border-subtle/70 transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-sunken/60',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 align-middle text-content-primary',
                      dense ? 'py-2' : 'py-3',
                      alignClass(column.align),
                      column.hideBelowLg && 'hidden lg:table-cell',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Mobile: stacked cards from the same definitions ---------- */}
      <ul className="divide-y divide-border-subtle md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                'flex flex-col gap-2.5 px-4 py-3.5 transition-colors',
                onRowClick && 'cursor-pointer active:bg-surface-sunken',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">{primaryColumn?.cell(row)}</div>
                {mobileActions ? (
                  <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                    {mobileActions(row)}
                  </div>
                ) : onRowClick ? (
                  <Icon name="chevron-right" size={16} className="mt-1 shrink-0 text-content-tertiary" />
                ) : null}
              </div>

              {secondaryColumns.length > 0 ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {secondaryColumns.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-[0.6875rem] font-medium tracking-wide text-content-tertiary uppercase">
                        {column.mobileLabel ?? column.header}
                      </dt>
                      <dd className="mt-0.5 truncate text-[0.8125rem] text-content-primary">
                        {column.cell(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Skeleton
   ========================================================================== */

export function TableSkeleton({
  columns = 5,
  rows = 6,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('animate-fade-in', className)} aria-busy aria-live="polite">
      <span className="sr-only">Loading data…</span>
      <div className="hidden md:block">
        <div className="flex gap-4 border-b border-border-subtle bg-surface-sunken/50 px-4 py-3">
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonBar key={index} className={index === 0 ? 'w-40' : 'w-24'} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 border-b border-border-subtle/70 px-4 py-4"
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <SkeletonBar
                key={columnIndex}
                className={columnIndex === 0 ? 'w-48' : columnIndex % 2 ? 'w-20' : 'w-28'}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="divide-y divide-border-subtle md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, index) => (
          <div key={index} className="space-y-3 px-4 py-4">
            <SkeletonBar className="w-2/3" />
            <div className="flex gap-6">
              <SkeletonBar className="w-20" />
              <SkeletonBar className="w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The shimmer bar every skeleton is built from. */
export function SkeletonBar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'block h-3 rounded-full bg-[linear-gradient(90deg,var(--color-ink-100)_25%,var(--color-ink-200)_37%,var(--color-ink-100)_63%)] bg-[length:200%_100%] animate-shimmer dark:bg-[linear-gradient(90deg,#1a242c_25%,#25313a_37%,#1a242c_63%)]',
        className,
      )}
      aria-hidden
    />
  );
}

/* ==========================================================================
   Pagination
   ========================================================================== */

export interface PaginationProps {
  page: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
  onPageChange: (page: number) => void;
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
  className?: string;
}

export function Pagination({
  page,
  lastPage,
  total,
  from,
  to,
  onPageChange,
  perPage,
  onPerPageChange,
  className,
}: PaginationProps) {
  if (total === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <p className="text-xs text-content-tertiary" data-numeric>
          Showing <span className="font-medium text-content-secondary">{from ?? 0}</span>–
          <span className="font-medium text-content-secondary">{to ?? 0}</span> of{' '}
          <span className="font-medium text-content-secondary">{total.toLocaleString()}</span>
        </p>
        {onPerPageChange && perPage ? (
          <label className="hidden items-center gap-1.5 text-xs text-content-tertiary sm:flex">
            <span className="sr-only">Rows per page</span>
            <select
              value={perPage}
              onChange={(event) => onPerPageChange(Number(event.target.value))}
              className="cursor-pointer rounded-md bg-surface-card px-1.5 py-1 text-xs ring-1 ring-border-default ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {[10, 25, 50, 100].map((option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          icon="chevron-left"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        {pageWindow(page, lastPage).map((entry, index) =>
          entry === null ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-content-tertiary">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[0.8125rem] font-medium transition-colors',
                entry === page
                  ? 'bg-brand-600 text-white'
                  : 'text-content-secondary hover:bg-ink-100 dark:hover:bg-surface-raised',
              )}
              data-numeric
            >
              {entry}
            </button>
          ),
        )}
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          icon="chevron-right"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        />
      </nav>
    </div>
  );
}

/**
 * Page numbers to render: always first and last, a window around the current
 * page, and `null` where a gap belongs. Keeps the control a fixed width however
 * many pages there are.
 */
function pageWindow(page: number, lastPage: number): Array<number | null> {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, lastPage, page]);

  for (const offset of [-1, 1]) {
    const candidate = page + offset;
    if (candidate > 1 && candidate < lastPage) pages.add(candidate);
  }

  if (page <= 3) [2, 3, 4].forEach((entry) => pages.add(entry));
  if (page >= lastPage - 2) [lastPage - 3, lastPage - 2, lastPage - 1].forEach((entry) => pages.add(entry));

  const sorted = [...pages].filter((entry) => entry >= 1 && entry <= lastPage).sort((a, b) => a - b);
  const result: Array<number | null> = [];

  sorted.forEach((entry, index) => {
    if (index > 0 && entry - sorted[index - 1] > 1) result.push(null);
    result.push(entry);
  });

  return result;
}
