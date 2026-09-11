'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, PasswordInput } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { updatePassword } from '@/lib/data-source';
import { useSubmit } from '@/lib/use-async';
import { cn } from '@/lib/utils';

/** Mirrors the backend's password rules, so the UI never promises more than it delivers. */
const RULES = [
  { label: 'At least 10 characters', test: (value: string) => value.length >= 10 },
  {
    label: 'Upper and lower case letters',
    test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  { label: 'At least one number', test: (value: string) => /\d/.test(value) },
];

export default function SecuritySettingsPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  const { submit, submitting, error, fieldErrors, reset } = useSubmit(updatePassword);

  const checks = useMemo(
    () => RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) })),
    [form.password],
  );

  const strength = checks.filter((check) => check.passed).length;
  const matches = form.password.length > 0 && form.password === form.password_confirmation;

  const canSubmit =
    form.current_password.length > 0 && strength === RULES.length && matches;

  async function handleSubmit() {
    const result = await submit(form);

    // `updatePassword` resolves with undefined on success, so a cleared error is
    // the signal. `useSubmit` returns undefined on failure too, hence the check.
    if (result === undefined && !error) {
      toast.success(
        'Password changed',
        'Your other devices have been signed out for security.',
      );
      setForm({ current_password: '', password: '', password_confirmation: '' });
      reset();
    }
  }

  return (
    <div className="space-y-4">
      {user?.must_change_password ? (
        <Alert tone="caution" title="Please choose your own password">
          Your password was set by someone else. Change it now so only you know it.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Change password"
          description="You will stay signed in here; every other device is signed out."
          icon="lock"
        />

        {error ? (
          <Alert tone="critical" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <div className="mt-5 space-y-5">
          <Field
            label="Current password"
            required
            error={fieldErrors.current_password}
            hint="Confirms it is really you, not just someone with your session."
          >
            <PasswordInput
              value={form.current_password}
              onChange={(event) =>
                setForm((current) => ({ ...current, current_password: event.target.value }))
              }
              autoComplete="current-password"
              disabled={submitting}
              size="lg"
            />
          </Field>

          <Field label="New password" required error={fieldErrors.password}>
            <PasswordInput
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              autoComplete="new-password"
              disabled={submitting}
              size="lg"
            />
          </Field>

          {form.password ? (
            <div className="space-y-2 rounded-xl bg-surface-sunken/70 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1" aria-hidden>
                  {RULES.map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors duration-300',
                        index < strength
                          ? strength === RULES.length
                            ? 'bg-positive-500'
                            : 'bg-caution-500'
                          : 'bg-border-default',
                      )}
                    />
                  ))}
                </div>
                <span
                  className={cn(
                    'text-[0.6875rem] font-semibold',
                    strength === RULES.length
                      ? 'text-positive-700 dark:text-positive-300'
                      : 'text-caution-700 dark:text-caution-300',
                  )}
                >
                  {strength === RULES.length ? 'Strong' : 'Keep going'}
                </span>
              </div>
              <ul className="space-y-1">
                {checks.map((check) => (
                  <li
                    key={check.label}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      check.passed
                        ? 'text-positive-700 dark:text-positive-300'
                        : 'text-content-tertiary',
                    )}
                  >
                    <Icon name={check.passed ? 'check-circle' : 'minus'} size={13} />
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field
            label="Confirm new password"
            required
            error={
              form.password_confirmation && !matches
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
              size="lg"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end border-t border-border-subtle pt-4">
          <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit} icon="lock">
            Change password
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="How your account is protected"
          description="What Fast Sold does on your behalf."
          icon="shield"
        />
        <ul className="mt-4 space-y-3">
          {[
            [
              'Rate-limited sign in',
              'Repeated failures are throttled per email and per network, so a password cannot be guessed by brute force.',
            ],
            [
              'Short-lived tokens',
              'Sessions last 12 hours, or 30 days if you chose to stay signed in. Signing out revokes the token immediately.',
            ],
            [
              'Every sign-in recorded',
              'Successful and failed attempts are written to your business’s audit log, with the time and network address.',
            ],
            [
              'Instant revocation',
              'If your account is deactivated, existing tokens stop working on the next request rather than at expiry.',
            ],
          ].map(([title, description]) => (
            <li key={title} className="flex gap-3">
              <Icon
                name="check-circle"
                size={16}
                className="mt-0.5 shrink-0 text-positive-600 dark:text-positive-400"
              />
              <div>
                <p className="text-[0.8125rem] font-medium text-content-primary">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-content-secondary">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
