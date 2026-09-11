'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, StatList } from '@/components/ui/card';
import { Field, Input, Select, Switch } from '@/components/ui/field';
import { Alert, CardSkeleton, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { fetchBusiness, updateBusiness } from '@/lib/data-source';
import { formatDate, formatQuantity } from '@/lib/format';
import { useAsync, useSubmit } from '@/lib/use-async';

/** A short list rather than every IANA zone — these cover most users, and the
 *  backend accepts any valid timezone if one is set another way. */
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'INR', 'PKR', 'SGD', 'JPY'];

export default function BusinessSettingsPage() {
  const toast = useToast();
  const business = useAsync(() => fetchBusiness(), []);

  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    contact_email: '',
    phone: '',
    website: '',
    industry: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    timezone: 'UTC',
    currency: 'USD',
    default_minimum_stock_level: '0',
  });
  const [notifications, setNotifications] = useState({
    low_stock_enabled: true,
    out_of_stock_enabled: true,
  });
  const [dirty, setDirty] = useState(false);

  const { submit, submitting, error, fieldErrors } = useSubmit(updateBusiness);

  useEffect(() => {
    const item = business.data;
    if (!item) return;

    setForm({
      name: item.name,
      legal_name: item.legal_name ?? '',
      contact_email: item.contact_email ?? '',
      phone: item.phone ?? '',
      website: item.website ?? '',
      industry: item.industry ?? '',
      address_line1: item.address.line1 ?? '',
      address_line2: item.address.line2 ?? '',
      city: item.address.city ?? '',
      state: item.address.state ?? '',
      postal_code: item.address.postal_code ?? '',
      country: item.address.country ?? '',
      timezone: item.timezone,
      currency: item.currency,
      default_minimum_stock_level: String(item.default_minimum_stock_level),
    });
    setNotifications({
      low_stock_enabled: item.settings.notifications?.low_stock_enabled ?? true,
      out_of_stock_enabled: item.settings.notifications?.out_of_stock_enabled ?? true,
    });
    setDirty(false);
  }, [business.data]);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function handleSubmit() {
    const saved = await submit({
      name: form.name.trim(),
      legal_name: form.legal_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      industry: form.industry.trim() || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim().toUpperCase() || null,
      timezone: form.timezone,
      currency: form.currency,
      default_minimum_stock_level: Number(form.default_minimum_stock_level || 0),
      settings: { notifications },
    });

    if (saved) {
      toast.success('Business settings saved', 'Your changes apply across the workspace.');
      setDirty(false);
      business.reload();
    }
  }

  if (business.loading && !business.data) return <CardSkeleton lines={8} />;

  if (business.error || !business.data) {
    return (
      <Card>
        <ErrorState message={business.error ?? undefined} onRetry={business.reload} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Business details"
          description="How your business is identified across the workspace."
          icon="building"
        />

        {error ? (
          <Alert tone="critical" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" required error={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                disabled={submitting}
              />
            </Field>

            <Field label="Legal name" error={fieldErrors.legal_name} hint="If it differs.">
              <Input
                value={form.legal_name}
                onChange={(event) => update('legal_name', event.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact email" error={fieldErrors.contact_email}>
              <Input
                type="email"
                icon="mail"
                value={form.contact_email}
                onChange={(event) => update('contact_email', event.target.value)}
                disabled={submitting}
              />
            </Field>

            <Field label="Phone" error={fieldErrors.phone}>
              <Input
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" error={fieldErrors.website} hint="Include https://">
              <Input
                type="url"
                value={form.website}
                onChange={(event) => update('website', event.target.value)}
                disabled={submitting}
              />
            </Field>

            <Field label="Industry" error={fieldErrors.industry}>
              <Input
                value={form.industry}
                onChange={(event) => update('industry', event.target.value)}
                placeholder="Wholesale distribution"
                disabled={submitting}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Address" icon="building" />
        <div className="mt-5 space-y-4">
          <Field label="Address line 1" error={fieldErrors.address_line1}>
            <Input
              value={form.address_line1}
              onChange={(event) => update('address_line1', event.target.value)}
              disabled={submitting}
            />
          </Field>

          <Field label="Address line 2" error={fieldErrors.address_line2}>
            <Input
              value={form.address_line2}
              onChange={(event) => update('address_line2', event.target.value)}
              disabled={submitting}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="City" error={fieldErrors.city}>
              <Input
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="State" error={fieldErrors.state}>
              <Input
                value={form.state}
                onChange={(event) => update('state', event.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Postal code" error={fieldErrors.postal_code}>
              <Input
                value={form.postal_code}
                onChange={(event) => update('postal_code', event.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Country" error={fieldErrors.country} hint="Two letters.">
              <Input
                value={form.country}
                maxLength={2}
                onChange={(event) => update('country', event.target.value)}
                className="uppercase"
                disabled={submitting}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Regional and inventory defaults"
          description="Applied when dates are displayed and when new products are created."
          icon="sliders"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Timezone" required error={fieldErrors.timezone}>
            <Select
              value={form.timezone}
              options={TIMEZONES.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))}
              onChange={(event) => update('timezone', event.target.value)}
              disabled={submitting}
            />
          </Field>

          <Field
            label="Currency"
            required
            error={fieldErrors.currency}
            hint="For reference prices only."
          >
            <Select
              value={form.currency}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(event) => update('currency', event.target.value)}
              disabled={submitting}
            />
          </Field>

          <Field
            label="Default minimum level"
            error={fieldErrors.default_minimum_stock_level}
            hint="Pre-filled on new products."
          >
            <Input
              type="number"
              min={0}
              value={form.default_minimum_stock_level}
              onChange={(event) => update('default_minimum_stock_level', event.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Business-wide alerts"
          description="Whether Ozipco Inventory raises stock alerts for everyone in this business. Individuals can still mute them for themselves."
          icon="bell"
        />
        <div className="mt-5 space-y-4">
          <Switch
            checked={notifications.low_stock_enabled}
            onChange={(checked) => {
              setNotifications((current) => ({ ...current, low_stock_enabled: checked }));
              setDirty(true);
            }}
            label="Low stock alerts"
            description="Raised when a product reaches or drops below its minimum level."
            disabled={submitting}
          />
          <Switch
            checked={notifications.out_of_stock_enabled}
            onChange={(checked) => {
              setNotifications((current) => ({ ...current, out_of_stock_enabled: checked }));
              setDirty(true);
            }}
            label="Out of stock alerts"
            description="Raised when a product has nothing left on hand."
            disabled={submitting}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Workspace" description="Read-only details." icon="info" />
        <div className="mt-5">
          <StatList
            columns={3}
            items={[
              { label: 'Workspace slug', value: business.data.slug },
              { label: 'Users', value: formatQuantity(business.data.users_count ?? 0) },
              { label: 'Created', value: formatDate(business.data.created_at) },
            ]}
          />
        </div>
      </Card>

      {/* Sticky save bar: these forms are long, and hunting for the button at the
          bottom of four cards is a poor experience. */}
      <div className="sticky bottom-4 z-10">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-card/95 p-3.5 shadow-lg ring-1 ring-border-subtle backdrop-blur-sm">
          <p className="text-xs text-content-tertiary">
            {dirty ? 'You have unsaved changes.' : 'Everything is saved.'}
          </p>
          <Button onClick={handleSubmit} loading={submitting} disabled={!dirty} icon="check">
            Save business settings
          </Button>
        </div>
      </div>
    </div>
  );
}
