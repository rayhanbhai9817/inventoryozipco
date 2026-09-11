'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Select } from '@/components/ui/field';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/table';
import { Alert, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states';
import { fetchAuditLog } from '@/lib/data-source';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { AuditLogEntry } from '@/types/api';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'product', label: 'Products' },
  { value: 'category', label: 'Categories' },
  { value: 'supplier', label: 'Suppliers' },
  { value: 'price', label: 'Pricing' },
  { value: 'user', label: 'Users' },
  { value: 'role', label: 'Roles' },
  { value: 'auth', label: 'Sign in' },
  { value: 'settings', label: 'Settings' },
  { value: 'security', label: 'Security' },
  { value: 'business', label: 'Business' },
];

const CATEGORY_ICONS: Record<string, IconName> = {
  inventory: 'boxes',
  product: 'package',
  category: 'tag',
  supplier: 'truck',
  price: 'file-text',
  user: 'users',
  role: 'shield',
  auth: 'lock',
  settings: 'settings',
  security: 'shield',
  business: 'building',
};

/**
 * The audit trail.
 *
 * Read-only, with no write affordance at all — the records cannot be edited or
 * deleted by anyone, through any route. Each entry can be expanded to show the
 * before/after values it captured.
 */
export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, loading, error, reload } = useAsync(
    () =>
      fetchAuditLog({
        search: search || undefined,
        category: category || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        per_page: 30,
      }),
    [search, category, dateFrom, dateTo, page],
  );

  const hasFilters = Boolean(search || category || dateFrom || dateTo);

  function clearFilters() {
    setSearch('');
    setCategory('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Who did what, when, and what the values were before. Visible to Owners only."
      />

      <Alert tone="info" icon="lock" title="Append-only by construction">
        Audit records cannot be edited or deleted — not from this screen, not from the API, not from
        the model layer. That is what makes the trail worth reading months later.
      </Alert>

      {/* ---------- Filters ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          loading={loading}
          placeholder="Search descriptions, users or actions…"
        />
        <Select
          value={category}
          placeholder="All categories"
          options={CATEGORIES}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          aria-label="From date"
          className="h-10 rounded-lg bg-surface-card px-3 text-sm text-content-primary ring-1 ring-border-default ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none"
        />
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          aria-label="To date"
          className="h-10 rounded-lg bg-surface-card px-3 text-sm text-content-primary ring-1 ring-border-default ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none"
        />
      </div>

      {hasFilters ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-tertiary">
            {data ? `${data.meta.total} matching entries` : 'Filtering…'}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      <Card flush>
        <CardHeader padded title="Activity" description="Newest first." icon="history" />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState label="Loading audit log…" />
        ) : (data?.data.length ?? 0) === 0 ? (
          <EmptyState
            icon="history"
            title={hasFilters ? 'No entries match these filters' : 'No activity recorded yet'}
            description={
              hasFilters
                ? 'Try widening the date range or clearing the filters.'
                : 'Actions taken in your workspace will be recorded here automatically.'
            }
            action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
          />
        ) : (
          <>
            <ul className="divide-y divide-border-subtle">
              {data?.data.map((entry) => (
                <AuditRow
                  key={entry.id}
                  entry={entry}
                  expanded={expanded === entry.id}
                  onToggle={() => setExpanded((current) => (current === entry.id ? null : entry.id))}
                />
              ))}
            </ul>

            {data ? (
              <Pagination
                page={data.meta.current_page}
                lastPage={data.meta.last_page}
                total={data.meta.total}
                from={data.meta.from}
                to={data.meta.to}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}

function AuditRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetail = Boolean(entry.old_values || entry.new_values || entry.meta);

  return (
    <li>
      <div className="flex items-start gap-3.5 px-5 py-3.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-content-secondary">
          <Icon name={CATEGORY_ICONS[entry.category] ?? 'activity'} size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="text-[0.8125rem] leading-snug font-medium text-content-primary">
              {entry.description}
            </p>
            <span
              className="shrink-0 text-xs whitespace-nowrap text-content-tertiary"
              title={formatDateTime(entry.created_at)}
            >
              {formatRelative(entry.created_at)}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-tertiary">
            <Badge tone="neutral" size="sm">
              {entry.action.label}
            </Badge>
            <span>{entry.user.name ?? 'System'}</span>
            {entry.resource.type ? (
              <span>
                {entry.resource.type}
                {entry.resource.id ? ` #${entry.resource.id}` : ''}
              </span>
            ) : null}
            {entry.ip_address ? <span className="font-mono">{entry.ip_address}</span> : null}
            <span title={formatDateTime(entry.created_at)}>{formatDateTime(entry.created_at)}</span>
          </div>

          {hasDetail ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {expanded ? 'Hide detail' : 'Show what changed'}
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} />
            </button>
          ) : null}

          {expanded && hasDetail ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {entry.old_values ? (
                <ValuePanel title="Before" values={entry.old_values} tone="before" />
              ) : null}
              {entry.new_values ? (
                <ValuePanel title="After" values={entry.new_values} tone="after" />
              ) : null}
              {entry.meta ? <ValuePanel title="Context" values={entry.meta} tone="meta" /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ValuePanel({
  title,
  values,
  tone,
}: {
  title: string;
  values: Record<string, unknown>;
  tone: 'before' | 'after' | 'meta';
}) {
  const tones = {
    before: 'bg-critical-50/60 ring-critical-500/15 dark:bg-critical-700/10',
    after: 'bg-positive-50/60 ring-positive-500/15 dark:bg-positive-700/10',
    meta: 'bg-surface-sunken ring-border-subtle',
  };

  return (
    <div className={cn('rounded-lg p-3 ring-1 ring-inset', tones[tone])}>
      <p className="text-[0.6875rem] font-semibold tracking-wide text-content-tertiary uppercase">
        {title}
      </p>
      <dl className="mt-2 space-y-1">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-xs">
            <dt className="shrink-0 text-content-tertiary">{key.replace(/_/g, ' ')}:</dt>
            <dd className="min-w-0 font-mono break-all text-content-secondary">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);

  return String(value);
}
