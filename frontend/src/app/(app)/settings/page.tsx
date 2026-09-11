'use client';

import { useEffect, useState } from 'react';

import { Avatar } from '@/components/layout/topbar';
import { RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, StatList } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/data-source';
import { formatDate, formatRelative } from '@/lib/format';
import { useSubmit } from '@/lib/use-async';

export default function ProfileSettingsPage() {
  const toast = useToast();
  const { user, refresh } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', job_title: '', phone: '' });
  const [dirty, setDirty] = useState(false);

  const { submit, submitting, error, fieldErrors } = useSubmit(updateProfile);

  useEffect(() => {
    if (!user) return;

    setForm({
      name: user.name,
      email: user.email,
      job_title: user.job_title ?? '',
      phone: user.phone ?? '',
    });
    setDirty(false);
  }, [user]);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function handleSubmit() {
    const saved = await submit({
      name: form.name.trim(),
      email: form.email.trim(),
      job_title: form.job_title.trim() || null,
      phone: form.phone.trim() || null,
    });

    if (saved) {
      toast.success('Profile updated', 'Your details have been saved.');
      setDirty(false);
      await refresh();
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Your profile"
          description="How you appear to the rest of your business."
          icon="user"
        />

        <div className="mt-5 flex items-center gap-4 rounded-xl bg-surface-sunken/70 p-4">
          <Avatar user={user} size={52} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-semibold text-content-primary">
              {user.name}
              <RoleBadge role={user.role.value} label={user.role.label} />
            </p>
            <p className="mt-0.5 truncate text-[0.8125rem] text-content-secondary">{user.email}</p>
            <p className="mt-1 text-xs text-content-tertiary">{user.role.description}</p>
          </div>
        </div>

        {error ? (
          <Alert tone="critical" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                disabled={submitting}
              />
            </Field>

            <Field
              label="Email address"
              required
              error={fieldErrors.email}
              hint="You sign in with this."
            >
              <Input
                type="email"
                icon="mail"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" error={fieldErrors.job_title}>
              <Input
                value={form.job_title}
                onChange={(event) => update('job_title', event.target.value)}
                placeholder="Operations Manager"
                disabled={submitting}
              />
            </Field>

            <Field label="Phone" error={fieldErrors.phone}>
              <Input
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                placeholder="Optional"
                disabled={submitting}
              />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <p className="text-xs text-content-tertiary">
            {dirty ? 'You have unsaved changes.' : 'Everything is saved.'}
          </p>
          <Button onClick={handleSubmit} loading={submitting} disabled={!dirty} icon="check">
            Save changes
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Account" description="Read-only details about your access." icon="info" />
        <div className="mt-5">
          <StatList
            columns={2}
            items={[
              { label: 'Role', value: user.role.label, hint: user.role.description },
              { label: 'Business', value: user.business?.name ?? '—' },
              {
                label: 'Last signed in',
                value: user.last_login_at ? formatRelative(user.last_login_at) : 'This session',
              },
              { label: 'Member since', value: formatDate(user.created_at) },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
