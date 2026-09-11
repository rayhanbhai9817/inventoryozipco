'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/data-source';
import { useSubmit } from '@/lib/use-async';

/**
 * Notification preferences.
 *
 * Only mutable types are listed. Administrative notices are deliberately absent:
 * the backend ignores an attempt to mute them, so offering the toggle would be a
 * promise the system does not keep.
 */
const PREFERENCES: Array<{ key: string; label: string; description: string }> = [
  {
    key: 'low_stock',
    label: 'Low stock',
    description: 'A product reaches or drops below its minimum stock level.',
  },
  {
    key: 'out_of_stock',
    label: 'Out of stock',
    description: 'A product has nothing left on hand.',
  },
  {
    key: 'stock_in_recorded',
    label: 'Stock in recorded',
    description: 'Someone records a receipt, with the new balance.',
  },
  {
    key: 'stock_out_recorded',
    label: 'Stock out recorded',
    description: 'Someone records a withdrawal, with the new balance.',
  },
  {
    key: 'inventory_adjusted',
    label: 'Inventory adjusted',
    description: 'A quantity is corrected after a stock count, damage or loss.',
  },
  {
    key: 'missing_supplier',
    label: 'Product without a supplier',
    description: 'A product has no supplier linked, which leaves reordering incomplete.',
  },
  {
    key: 'missing_price_reference',
    label: 'Product without a reference price',
    description: 'A product is not in the price catalogue.',
  },
  {
    key: 'user_invited',
    label: 'User invited',
    description: 'A new person is given access to the business.',
  },
  {
    key: 'role_changed',
    label: 'Role changed',
    description: 'Your own permissions in this business change.',
  },
];

export default function NotificationSettingsPage() {
  const toast = useToast();
  const { user, refresh } = useAuth();

  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const { submit, submitting, error } = useSubmit(updateProfile);

  useEffect(() => {
    if (!user) return;

    // Anything not stored is on by default, which is what the backend assumes too.
    setPreferences(
      Object.fromEntries(
        PREFERENCES.map((entry) => [entry.key, user.notification_preferences[entry.key] ?? true]),
      ),
    );
    setDirty(false);
  }, [user]);

  function toggle(key: string, value: boolean) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function handleSubmit() {
    const saved = await submit({ notification_preferences: preferences });

    if (saved) {
      toast.success('Preferences saved', 'Your notification settings have been updated.');
      setDirty(false);
      await refresh();
    }
  }

  const enabledCount = Object.values(preferences).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Notification preferences"
          description={`${enabledCount} of ${PREFERENCES.length} notification types enabled for your account.`}
          icon="bell"
          actions={
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreferences(
                    Object.fromEntries(PREFERENCES.map((entry) => [entry.key, true])),
                  );
                  setDirty(true);
                }}
              >
                Enable all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreferences(
                    Object.fromEntries(PREFERENCES.map((entry) => [entry.key, false])),
                  );
                  setDirty(true);
                }}
              >
                Mute all
              </Button>
            </div>
          }
        />

        {error ? (
          <Alert tone="critical" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <ul className="mt-5 divide-y divide-border-subtle">
          {PREFERENCES.map((preference) => (
            <li key={preference.key} className="py-3.5 first:pt-0">
              <Switch
                checked={preferences[preference.key] ?? true}
                onChange={(checked) => toggle(preference.key, checked)}
                label={preference.label}
                description={preference.description}
                disabled={submitting}
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <p className="text-xs text-content-tertiary">
            {dirty ? 'You have unsaved changes.' : 'Everything is saved.'}
          </p>
          <Button onClick={handleSubmit} loading={submitting} disabled={!dirty} icon="check">
            Save preferences
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex gap-3">
          <Icon name="info" size={18} className="mt-px shrink-0 text-content-tertiary" />
          <div>
            <p className="text-[0.8125rem] font-semibold text-content-primary">
              Administrative notices cannot be muted
            </p>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-content-secondary">
              A small number of notices — changes to roles, permissions and business settings — are
              always delivered. They are not listed above, because the backend ignores an attempt to
              mute them and showing a toggle that does nothing would be worse than not showing one.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
