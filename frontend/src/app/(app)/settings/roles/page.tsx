'use client';

import { useEffect, useMemo, useState } from 'react';

import { Badge, RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/tabs';
import { Alert, CardSkeleton, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { fetchRoles, updateRolePermissions } from '@/lib/data-source';
import { useAsync, useSubmit } from '@/lib/use-async';
import type { PermissionKey, RoleKey } from '@/types/api';
import { cn } from '@/lib/utils';

/**
 * The role permission matrix.
 *
 * Owner is shown but not editable: owners are authorised unconditionally in code,
 * so an editable matrix for them would be fiction. Owner-only permissions are
 * rendered as permanently locked for the other roles, because the backend filters
 * them out even if a row is forced into the database.
 */
export default function RolesSettingsPage() {
  const toast = useToast();
  const roles = useAsync(() => fetchRoles(), []);

  const [activeRole, setActiveRole] = useState<RoleKey>('manager');
  const [selected, setSelected] = useState<Set<PermissionKey>>(new Set());
  const [dirty, setDirty] = useState(false);

  const { submit, submitting, error } = useSubmit(updateRolePermissions);

  const role = useMemo(
    () => roles.data?.roles.find((entry) => entry.key === activeRole),
    [roles.data, activeRole],
  );

  useEffect(() => {
    if (!role) return;

    setSelected(new Set(role.permissions));
    setDirty(false);
  }, [role]);

  function toggle(key: PermissionKey) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
    setDirty(true);
  }

  function toggleGroup(keys: PermissionKey[], enable: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      keys.forEach((key) => (enable ? next.add(key) : next.delete(key)));
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!role) return;

    const result = await submit(role.key, [...selected]);

    if (result === undefined && !error) {
      toast.success(`${role.label} permissions saved`, 'The change applies on their next request.');
      setDirty(false);
      roles.reload();
    }
  }

  if (roles.loading && !roles.data) return <CardSkeleton lines={10} />;

  if (roles.error || !roles.data) {
    return (
      <Card>
        <ErrorState message={roles.error ?? undefined} onRetry={roles.reload} />
      </Card>
    );
  }

  const isOwner = activeRole === 'owner';

  return (
    <div className="space-y-4">
      <Alert tone="info" icon="shield" title="Every check happens on the server">
        This matrix is the authority the backend consults on each request. Hiding a control in the
        interface is a courtesy; the permission check is what actually prevents the action.
      </Alert>

      <Card>
        <CardHeader
          title="Roles"
          description="Choose a role to see and adjust what it can do in your business."
          icon="shield"
        />

        <div className="mt-5">
          <SegmentedControl
            aria-label="Select a role"
            options={roles.data.roles.map((entry) => ({ value: entry.key, label: entry.label }))}
            value={activeRole}
            onChange={setActiveRole}
          />
        </div>

        {role ? (
          <div className="mt-5 flex flex-wrap items-start gap-3 rounded-xl bg-surface-sunken/70 p-4">
            <RoleBadge role={role.key} label={role.label} />
            <p className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-content-secondary">
              {role.description}
            </p>
            <Badge tone={role.is_editable ? 'positive' : 'neutral'} size="sm">
              {role.is_editable ? 'Editable' : 'Fixed'}
            </Badge>
          </div>
        ) : null}

        {isOwner ? (
          <Alert tone="caution" className="mt-4" icon="lock" title="The Owner role is not editable">
            Owners hold every permission unconditionally, resolved in code rather than read from this
            matrix. That is what guarantees a business can always administer itself — and it is why
            the last active Owner cannot be demoted or removed.
          </Alert>
        ) : null}
      </Card>

      {error ? <Alert tone="critical">{error}</Alert> : null}

      {/* ---------- Permission groups ---------- */}
      <div className="space-y-3">
        {roles.data.catalogue.map((group) => {
          const grantable = group.permissions.filter((permission) => !permission.owner_only);
          const grantableKeys = grantable.map((permission) => permission.key);
          const allOn = grantableKeys.every((key) => selected.has(key));
          const someOn = grantableKeys.some((key) => selected.has(key));

          return (
            <Card key={group.group}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[0.9375rem] font-semibold text-content-primary">
                  {group.group}
                </h3>
                {!isOwner && grantableKeys.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => toggleGroup(grantableKeys, !allOn)}
                  >
                    {allOn ? 'Clear group' : 'Select group'}
                  </Button>
                ) : someOn && isOwner ? null : null}
              </div>

              <ul className="mt-3 divide-y divide-border-subtle">
                {group.permissions.map((permission) => {
                  const granted = isOwner || selected.has(permission.key);
                  const locked = isOwner || permission.owner_only;

                  return (
                    <li key={permission.key} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={granted}
                        aria-label={permission.label}
                        disabled={locked || submitting}
                        onClick={() => toggle(permission.key)}
                        className={cn(
                          'relative inline-flex h-[1.375rem] w-[2.375rem] shrink-0 items-center rounded-full transition-colors',
                          granted ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700',
                          locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-[1.0625rem] w-[1.0625rem] rounded-full bg-white shadow-sm transition-transform',
                            granted ? 'translate-x-[1.1875rem]' : 'translate-x-[0.1875rem]',
                          )}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="text-[0.8125rem] font-medium text-content-primary">
                          {permission.label}
                        </p>
                        <p className="mt-0.5 font-mono text-[0.6875rem] text-content-tertiary">
                          {permission.key}
                        </p>
                      </div>

                      {permission.owner_only ? (
                        <Badge tone="brand" size="sm" icon="lock">
                          Owner only
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      {!isOwner ? (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-card/95 p-3.5 shadow-lg ring-1 ring-border-subtle backdrop-blur-sm">
            <p className="flex items-center gap-2 text-xs text-content-tertiary">
              <Icon name="shield" size={14} />
              {dirty
                ? `${selected.size} permissions selected — unsaved.`
                : `${selected.size} permissions granted to ${role?.label ?? 'this role'}.`}
            </p>
            <Button onClick={handleSave} loading={submitting} disabled={!dirty} icon="check">
              Save permissions
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Per-person exceptions"
          description="When one person needs something their role does not have — or should not have something it does."
          icon="user"
        />
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-content-secondary">
          Individual grants and revocations layer on top of a role. Only the{' '}
          <em>difference</em> from the role is stored, so a later change to this matrix still reaches
          that person. Set them when editing a user.
        </p>
      </Card>
    </div>
  );
}
