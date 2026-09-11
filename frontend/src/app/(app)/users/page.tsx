'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Avatar } from '@/components/layout/topbar';
import { ActiveBadge, Badge, RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RowActions } from '@/components/ui/dropdown';
import { Field, Input, PasswordInput, Select, Switch } from '@/components/ui/field';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedControl } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { Alert, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { createUser, deleteUser, fetchUsers, updateUser } from '@/lib/data-source';
import { formatRelative } from '@/lib/format';
import { useAsync, useSubmit } from '@/lib/use-async';
import type { RoleKey, User } from '@/types/api';

export default function UsersPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading users…" />}>
      <UsersView />
    </Suspense>
  );
}

function UsersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { can, user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleKey>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);

  const { data, loading, error, reload } = useAsync(
    () =>
      fetchUsers({
        search: search || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
      }),
    [search, roleFilter],
  );

  useEffect(() => {
    if (searchParams.get('new') === '1' && can('users.manage')) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/users');
    }
  }, [searchParams, can, router]);

  async function handleRemove() {
    if (!removeTarget) return;

    try {
      await deleteUser(removeTarget.id);
      toast.success('User removed', `${removeTarget.name} no longer has access.`);
      reload();
    } catch {
      toast.error(
        'Could not remove that user',
        'The last active Owner cannot be removed, and you cannot remove yourself.',
      );
    } finally {
      setRemoveTarget(null);
    }
  }

  async function handleToggleActive(user: User) {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      toast.success(
        user.is_active ? 'User deactivated' : 'User activated',
        user.is_active
          ? `${user.name} can no longer sign in, and their API tokens have been revoked.`
          : `${user.name} can sign in again.`,
      );
      reload();
    } catch {
      toast.error('That did not work', 'The last active Owner cannot be deactivated.');
    }
  }

  const columns: Array<Column<User>> = [
    {
      key: 'user',
      header: 'Person',
      primary: true,
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar user={user} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-content-primary">
              {user.name}
              {user.id === currentUser?.id ? (
                <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[0.625rem] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-200">
                  You
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-content-tertiary">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (user) => <RoleBadge role={user.role.value} label={user.role.label} />,
    },
    {
      key: 'title',
      header: 'Job title',
      hideBelowLg: true,
      cell: (user) => (
        <span className="text-[0.8125rem] text-content-secondary">{user.job_title ?? '—'}</span>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last signed in',
      hideBelowLg: true,
      cell: (user) => (
        <span className="text-xs text-content-secondary">
          {user.last_login_at ? formatRelative(user.last_login_at) : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (user) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {user.must_change_password ? (
            <Badge tone="caution" size="sm">
              Must reset
            </Badge>
          ) : null}
          <ActiveBadge active={user.is_active} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      hideOnMobile: true,
      cell: (user) => {
        const isSelf = user.id === currentUser?.id;

        if (!can('users.manage')) return null;

        return (
          <RowActions
            items={[
              {
                label: 'Edit user',
                icon: 'edit',
                onClick: () => {
                  setEditing(user);
                  setFormOpen(true);
                },
              },
              'separator',
              {
                label: user.is_active ? 'Deactivate' : 'Activate',
                icon: user.is_active ? 'lock' : 'refresh',
                disabled: isSelf,
                hint: isSelf ? 'Not yourself' : undefined,
                onClick: () => void handleToggleActive(user),
              },
              {
                label: 'Remove user',
                icon: 'trash',
                destructive: true,
                disabled: isSelf,
                hint: isSelf ? 'Not yourself' : undefined,
                onClick: () => setRemoveTarget(user),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Who can reach your inventory, and what each of them may do."
        actions={
          can('users.manage') ? (
            <Button
              icon="user-plus"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add user
            </Button>
          ) : null
        }
      />

      <Alert tone="info" icon="shield">
        Roles are enforced on every request by the backend. Deactivating someone revokes their API
        tokens immediately rather than waiting for them to expire. The last active Owner cannot be
        removed or demoted, so a business can never lock itself out.
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          loading={loading}
          placeholder="Search by name, email or job title…"
          className="min-w-0 flex-1 sm:max-w-sm"
        />
        <SegmentedControl
          aria-label="Filter by role"
          options={[
            { value: 'all', label: 'All' },
            { value: 'owner', label: 'Owners' },
            { value: 'manager', label: 'Managers' },
            { value: 'staff', label: 'Staff' },
          ]}
          value={roleFilter}
          onChange={setRoleFilter}
        />
      </div>

      <Card flush>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(user) => user.id}
            loading={loading && !data}
            empty={
              search || roleFilter !== 'all' ? (
                <EmptyState
                  icon="search"
                  title="No users match"
                  description="Try a different search term or role."
                  action={{
                    label: 'Clear filters',
                    onClick: () => {
                      setSearch('');
                      setRoleFilter('all');
                    },
                  }}
                />
              ) : (
                <EmptyState
                  icon="users"
                  title="You are the only user"
                  description="Invite a colleague and give them the access they need — Manager for day-to-day operations, Staff for recording movements."
                  action={
                    can('users.manage')
                      ? {
                          label: 'Add a user',
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
            mobileActions={(user) => <RoleBadge role={user.role.value} label={user.role.label} />}
          />
        )}
      </Card>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        assignableRoles={currentUser?.assignable_roles ?? []}
        onSaved={reload}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove this user?"
        confirmLabel="Remove user"
        message={
          <>
            <strong className="text-content-primary">{removeTarget?.name}</strong> will lose access
            immediately, and their API tokens will be revoked.
          </>
        }
        detail="Their name stays attached to the movements and audit entries they created, so your history remains complete and attributable."
      />
    </div>
  );
}

/* ========================================================================== */
/* Form                                                                       */
/* ========================================================================== */

function UserFormModal({
  open,
  onClose,
  user,
  assignableRoles,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
  assignableRoles: Array<{ value: RoleKey; label: string }>;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isEditing = Boolean(user);
  const isSelf = user?.id === currentUser?.id;

  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'staff' as RoleKey,
    job_title: '',
    phone: '',
    password: '',
    password_confirmation: '',
    is_active: true,
    must_change_password: true,
  });

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(
    async (payload: Record<string, unknown>) =>
      isEditing && user ? updateUser(user.id, payload) : createUser(payload),
  );

  useEffect(() => {
    if (!open) return;

    reset();
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role.value ?? 'staff',
      job_title: user?.job_title ?? '',
      phone: user?.phone ?? '',
      password: '',
      password_confirmation: '',
      is_active: user?.is_active ?? true,
      must_change_password: user ? user.must_change_password : true,
    });
  }, [open, user, reset]);

  async function handleSubmit() {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      job_title: form.job_title.trim() || null,
      phone: form.phone.trim() || null,
      must_change_password: form.must_change_password,
    };

    // A role change and a deactivation are authorised separately by the backend,
    // and must not be sent for your own account at all.
    if (!isSelf) {
      payload.role = form.role;
      payload.is_active = form.is_active;
    }

    if (!isEditing || form.password) {
      payload.password = form.password;
      payload.password_confirmation = form.password_confirmation;
    }

    const saved = await submit(payload);

    if (saved) {
      toast.success(
        isEditing ? 'User updated' : 'User added',
        isEditing
          ? `${saved.name} has been saved.`
          : `${saved.name} can now sign in with the password you set.`,
      );
      onSaved();
      onClose();
    }
  }

  const passwordRequired = !isEditing;
  const passwordValid = passwordRequired
    ? form.password.length >= 10 && form.password === form.password_confirmation
    : !form.password || form.password === form.password_confirmation;

  const canSubmit =
    form.name.trim().length >= 2 && form.email.trim().length > 3 && passwordValid;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit user' : 'Add a user'}
      description={
        isEditing
          ? 'Changes take effect on their next request.'
          : 'Create an account and set a temporary password to share with them.'
      }
      icon="user-plus"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
            {isEditing ? 'Save changes' : 'Add user'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pt-1">
        {error ? <Alert tone="critical">{error}</Alert> : null}

        {isSelf ? (
          <Alert tone="caution" icon="info">
            This is your own account, so role and activation are not editable here — nobody can
            change their own role or deactivate themselves. Use Settings → Profile for your details.
          </Alert>
        ) : null}

        <Field label="Full name" required error={fieldErrors.name}>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Alex Morgan"
            disabled={submitting}
            size="lg"
          />
        </Field>

        <Field
          label="Email address"
          required
          error={fieldErrors.email}
          hint="They sign in with this. It must be unique across the platform."
        >
          <Input
            type="email"
            icon="mail"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="alex@yourbusiness.com"
            disabled={submitting}
            size="lg"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" error={fieldErrors.job_title}>
            <Input
              value={form.job_title}
              onChange={(event) =>
                setForm((current) => ({ ...current, job_title: event.target.value }))
              }
              placeholder="Warehouse Associate"
              disabled={submitting}
            />
          </Field>

          <Field label="Phone" error={fieldErrors.phone}>
            <Input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Optional"
              disabled={submitting}
            />
          </Field>
        </div>

        {!isSelf ? (
          <Field
            label="Role"
            required
            error={fieldErrors.role}
            hint="You can only assign roles at or below your own."
          >
            <Select
              value={form.role}
              options={
                assignableRoles.length > 0
                  ? assignableRoles.map((role) => ({ value: role.value, label: role.label }))
                  : [
                      { value: 'manager', label: 'Manager' },
                      { value: 'staff', label: 'Staff' },
                    ]
              }
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as RoleKey }))
              }
              disabled={submitting}
              size="lg"
            />
          </Field>
        ) : null}

        <fieldset className="space-y-4 border-t border-border-subtle pt-4">
          <legend className="text-xs font-semibold tracking-wide text-content-tertiary uppercase">
            {isEditing ? 'Reset password' : 'Temporary password'}
          </legend>

          {isEditing ? (
            <p className="text-xs leading-relaxed text-content-tertiary">
              Leave blank to keep their current password. Setting a new one signs them out of every
              device.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Password"
              required={passwordRequired}
              error={fieldErrors.password}
              hint="At least 10 characters, mixed case and a number."
            >
              <PasswordInput
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                autoComplete="new-password"
                disabled={submitting}
              />
            </Field>

            <Field
              label="Confirm password"
              required={passwordRequired}
              error={
                form.password_confirmation && form.password !== form.password_confirmation
                  ? 'The two passwords do not match.'
                  : fieldErrors.password_confirmation
              }
            >
              <PasswordInput
                value={form.password_confirmation}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password_confirmation: event.target.value }))
                }
                autoComplete="new-password"
                disabled={submitting}
              />
            </Field>
          </div>

          <Switch
            checked={form.must_change_password}
            onChange={(checked) =>
              setForm((current) => ({ ...current, must_change_password: checked }))
            }
            label="Require a password change on first sign in"
            description="Recommended whenever you set a password on someone's behalf."
            disabled={submitting}
          />
        </fieldset>

        {!isSelf ? (
          <div className="border-t border-border-subtle pt-4">
            <Switch
              checked={form.is_active}
              onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              label="Active"
              description="Deactivating revokes their API tokens immediately."
              disabled={submitting}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
