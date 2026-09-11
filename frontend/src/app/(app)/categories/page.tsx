'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { ActiveBadge, CategoryChip } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RowActions } from '@/components/ui/dropdown';
import { Field, Input, Switch, Textarea } from '@/components/ui/field';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { DataTable, type Column } from '@/components/ui/table';
import { Alert, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '@/lib/data-source';
import { formatQuantity } from '@/lib/format';
import { useAsync, useSubmit } from '@/lib/use-async';
import type { Category } from '@/types/api';
import { cn } from '@/lib/utils';

/** Swatches drawn from the design system, so a user's choice always fits. */
const COLOURS = [
  '#137E87',
  '#1F9FA5',
  '#FF5A1F',
  '#F79009',
  '#12B76A',
  '#2E90FA',
  '#6366F1',
  '#A855F7',
  '#F04438',
  '#697B85',
];

export default function CategoriesPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading categories…" />}>
      <CategoriesView />
    </Suspense>
  );
}

function CategoriesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { can } = useAuth();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => fetchCategories({ search: search || undefined, per_page: 100 }),
    [search],
  );

  useEffect(() => {
    if (searchParams.get('new') === '1' && can('categories.manage')) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/categories');
    }
  }, [searchParams, can, router]);

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      await deleteCategory(deleteTarget.id);
      toast.success('Category deleted', `"${deleteTarget.name}" has been removed.`);
      reload();
    } catch {
      toast.error(
        'Could not delete that category',
        'Categories with products cannot be deleted — deactivate it instead.',
      );
    } finally {
      setDeleteTarget(null);
    }
  }

  const columns: Array<Column<Category>> = [
    {
      key: 'name',
      header: 'Category',
      primary: true,
      cell: (category) => (
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-8 shrink-0 rounded-lg"
            style={{
              backgroundColor: category.color
                ? `color-mix(in oklab, ${category.color} 18%, transparent)`
                : 'var(--surface-sunken)',
              boxShadow: category.color
                ? `inset 0 0 0 1.5px color-mix(in oklab, ${category.color} 45%, transparent)`
                : undefined,
            }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-content-primary">
              {category.name}
            </p>
            {category.description ? (
              <p className="mt-0.5 truncate text-xs text-content-tertiary">{category.description}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      cell: (category) => (
        <span className="text-[0.8125rem] tabular-nums text-content-secondary">
          {formatQuantity(category.products_count ?? 0)}
        </span>
      ),
    },
    {
      key: 'units',
      header: 'Units on hand',
      align: 'right',
      hideBelowLg: true,
      cell: (category) => (
        <span className="text-[0.8125rem] font-medium tabular-nums text-content-primary">
          {formatQuantity(category.units_on_hand ?? 0)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (category) => <ActiveBadge active={category.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      hideOnMobile: true,
      cell: (category) =>
        can('categories.manage') ? (
          <RowActions
            items={[
              {
                label: 'Edit category',
                icon: 'edit',
                onClick: () => {
                  setEditing(category);
                  setFormOpen(true);
                },
              },
              {
                label: 'View products',
                icon: 'package',
                href: `/products?category=${category.id}`,
              },
              'separator',
              {
                label: 'Delete category',
                icon: 'trash',
                destructive: true,
                disabled: (category.products_count ?? 0) > 0,
                hint: (category.products_count ?? 0) > 0 ? 'Has products' : undefined,
                onClick: () => setDeleteTarget(category),
              },
            ]}
          />
        ) : null,
    },
  ];

  const totalProducts = data?.data.reduce((sum, category) => sum + (category.products_count ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories"
        description="Group products so reporting and filtering reflect how you think about your stock."
        actions={
          can('categories.manage') ? (
            <Button
              icon="plus"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              New category
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          loading={loading}
          placeholder="Search categories…"
          className="min-w-0 flex-1 sm:max-w-sm"
        />
        {data ? (
          <p className="text-xs text-content-tertiary tabular-nums">
            {data.meta.total} categories · {formatQuantity(totalProducts ?? 0)} products
          </p>
        ) : null}
      </div>

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(category) => category.id}
            loading={loading && !data}
            empty={
              search ? (
                <EmptyState
                  icon="search"
                  title="No categories match"
                  description="Try a different search term."
                  action={{ label: 'Clear search', onClick: () => setSearch('') }}
                />
              ) : (
                <EmptyState
                  icon="tag"
                  title="No categories yet"
                  description="Categories are optional, but they make reports and filters far more useful once you have more than a handful of products."
                  action={
                    can('categories.manage')
                      ? {
                          label: 'Create your first category',
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
            mobileActions={(category) => <ActiveBadge active={category.is_active} />}
          />
        )}
      </Card>

      <CategoryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        category={editing}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this category?"
        confirmLabel="Delete category"
        message={
          <>
            <strong className="text-content-primary">{deleteTarget?.name}</strong> will be removed
            permanently.
          </>
        }
        detail="Only empty categories can be deleted. If products still reference it, deactivate it instead so those products keep a valid category."
      />
    </div>
  );
}

/* ========================================================================== */
/* Form                                                                       */
/* ========================================================================== */

function CategoryFormModal({
  open,
  onClose,
  category,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEditing = Boolean(category);

  const [form, setForm] = useState({
    name: '',
    description: '',
    color: COLOURS[0],
    is_active: true,
  });

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(
    async (payload: Record<string, unknown>) =>
      isEditing && category ? updateCategory(category.id, payload) : createCategory(payload),
  );

  useEffect(() => {
    if (!open) return;

    reset();
    setForm({
      name: category?.name ?? '',
      description: category?.description ?? '',
      color: category?.color ?? COLOURS[0],
      is_active: category?.is_active ?? true,
    });
  }, [open, category, reset]);

  async function handleSubmit() {
    const saved = await submit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      is_active: form.is_active,
    });

    if (saved) {
      toast.success(isEditing ? 'Category updated' : 'Category created', `"${saved.name}" saved.`);
      onSaved();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit category' : 'New category'}
      icon="tag"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={form.name.trim().length < 2}>
            {isEditing ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pt-1">
        {error ? <Alert tone="critical">{error}</Alert> : null}

        <Field label="Name" required error={fieldErrors.name}>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Power Tools"
            disabled={submitting}
            size="lg"
          />
        </Field>

        <Field label="Description" error={fieldErrors.description}>
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="What belongs in this category."
            rows={2}
            disabled={submitting}
          />
        </Field>

        <Field
          label="Colour"
          error={fieldErrors.color}
          hint="Used for the category chip throughout the app."
        >
          <div className="flex flex-wrap gap-2">
            {COLOURS.map((colour) => (
              <button
                key={colour}
                type="button"
                aria-label={`Use colour ${colour}`}
                aria-pressed={form.color === colour}
                onClick={() => setForm((current) => ({ ...current, color: colour }))}
                className={cn(
                  'h-9 w-9 rounded-lg transition-transform',
                  form.color === colour
                    ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface-card'
                    : 'hover:scale-105',
                )}
                style={{
                  backgroundColor: colour,
                  ...(form.color === colour ? { boxShadow: `0 0 0 2px ${colour}` } : {}),
                }}
                disabled={submitting}
              />
            ))}
          </div>
        </Field>

        <div className="rounded-xl bg-surface-sunken/70 p-3.5">
          <p className="mb-2 text-xs font-medium tracking-wide text-content-tertiary uppercase">
            Preview
          </p>
          <CategoryChip name={form.name || 'Category name'} color={form.color} />
        </div>

        <div className="border-t border-border-subtle pt-4">
          <Switch
            checked={form.is_active}
            onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
            label="Active"
            description="Inactive categories stay on existing products but are hidden from pickers."
            disabled={submitting}
          />
        </div>
      </div>
    </Modal>
  );
}
