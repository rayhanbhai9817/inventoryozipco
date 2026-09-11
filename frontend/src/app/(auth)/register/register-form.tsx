'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, PasswordInput } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { DEMO_MODE } from '@/lib/data-source';
import { cn } from '@/lib/utils';

/**
 * Business registration.
 *
 * Five fields and a checkbox. Everything else — address, logo, currency, minimum
 * stock defaults — is set later in Settings, because asking for it now would
 * lengthen the form without improving the outcome.
 */

interface FieldErrors {
  business_name?: string;
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
  terms_accepted?: string;
}

/** Mirrors the backend's `Password::min(10)->letters()->mixedCase()->numbers()`. */
const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (value: string) => value.length >= 10 },
  { label: 'Upper and lower case', test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'At least one number', test: (value: string) => /\d/.test(value) },
];

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    business_name: '',
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) })),
    [form.password],
  );

  const passwordStrength = passwordChecks.filter((check) => check.passed).length;

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    // Clear the error for a field as soon as the user edits it, rather than
    // leaving a stale complaint on screen while they fix it.
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (form.business_name.trim().length < 2) {
      errors.business_name = 'Enter your business name.';
    }

    if (form.name.trim().length < 2) {
      errors.name = 'Enter your full name.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (passwordStrength < PASSWORD_RULES.length) {
      errors.password = 'Your password does not meet all the requirements yet.';
    }

    if (form.password !== form.password_confirmation) {
      errors.password_confirmation = 'The two passwords do not match.';
    }

    if (!termsAccepted) {
      errors.terms_accepted = 'Please accept the terms of service to continue.';
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      await register({
        business_name: form.business_name.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        password_confirmation: form.password_confirmation,
        // The browser knows the user's timezone; asking would be redundant.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        terms_accepted: true,
      });

      toast.success('Your business is ready', 'Start by adding a product or a supplier.');
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.isValidation) {
          setFieldErrors({
            business_name: error.fieldError('business_name'),
            name: error.fieldError('name'),
            email: error.fieldError('email'),
            password: error.fieldError('password'),
            password_confirmation: error.fieldError('password_confirmation'),
            terms_accepted: error.fieldError('terms_accepted'),
          });
          setFormError('Please check the highlighted fields.');
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-rise">
      <header>
        <h1 className="font-display text-display-xs font-semibold tracking-tight text-content-primary">
          Create your business
        </h1>
        <p className="mt-2 text-sm text-content-secondary">
          You will be the Owner, with a workspace isolated from every other business on the platform.
        </p>
      </header>

      {DEMO_MODE ? (
        <Alert tone="brand" className="mt-6" title="Demo workspace" icon="sparkles">
          This build runs on bundled demo data. Registering will take you straight into the demo
          dashboard without creating anything.
        </Alert>
      ) : null}

      {formError ? (
        <Alert tone="critical" className="mt-6" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
        <Field
          label="Business name"
          error={fieldErrors.business_name}
          hint="This is what your team will see across the app."
          required
        >
          <Input
            name="business_name"
            autoComplete="organization"
            icon="building"
            size="lg"
            placeholder="Acme Supply Co"
            value={form.business_name}
            onChange={(event) => update('business_name', event.target.value)}
            disabled={submitting}
            autoFocus
          />
        </Field>

        <Field label="Your name" error={fieldErrors.name} required>
          <Input
            name="name"
            autoComplete="name"
            icon="user"
            size="lg"
            placeholder="Alex Morgan"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            disabled={submitting}
          />
        </Field>

        <Field label="Work email" error={fieldErrors.email} required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            icon="mail"
            size="lg"
            placeholder="you@acmesupply.com"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            disabled={submitting}
          />
        </Field>

        <Field label="Password" error={fieldErrors.password} required>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            size="lg"
            placeholder="Choose a strong password"
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            disabled={submitting}
          />
        </Field>

        {/* Live requirement checklist: telling the user what is still missing as
            they type beats rejecting the form after they submit it. */}
        {form.password ? (
          <div className="space-y-2 rounded-xl bg-surface-sunken/70 p-3.5">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden>
                {PASSWORD_RULES.map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-300',
                      index < passwordStrength
                        ? passwordStrength === PASSWORD_RULES.length
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
                  passwordStrength === PASSWORD_RULES.length
                    ? 'text-positive-700 dark:text-positive-300'
                    : 'text-caution-700 dark:text-caution-300',
                )}
              >
                {passwordStrength === PASSWORD_RULES.length ? 'Strong' : 'Keep going'}
              </span>
            </div>
            <ul className="space-y-1">
              {passwordChecks.map((check) => (
                <li
                  key={check.label}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-colors',
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

        <Field label="Confirm password" error={fieldErrors.password_confirmation} required>
          <PasswordInput
            name="password_confirmation"
            autoComplete="new-password"
            size="lg"
            placeholder="Type it once more"
            value={form.password_confirmation}
            onChange={(event) => update('password_confirmation', event.target.value)}
            disabled={submitting}
          />
        </Field>

        <div>
          <Checkbox
            name="terms_accepted"
            checked={termsAccepted}
            onChange={(event) => {
              setTermsAccepted(event.target.checked);
              setFieldErrors((current) => ({ ...current, terms_accepted: undefined }));
            }}
            disabled={submitting}
            label={
              <>
                I agree to the{' '}
                <Link
                  href="/terms"
                  className="rounded font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                >
                  terms of service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="rounded font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                >
                  privacy policy
                </Link>
              </>
            }
          />
          {fieldErrors.terms_accepted ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-critical-600">
              <Icon name="alert-circle" size={13} />
              {fieldErrors.terms_accepted}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting} trailingIcon="arrow-right">
          {submitting ? 'Creating your workspace…' : 'Create business'}
        </Button>
      </form>

      <p className="mt-7 text-center text-[0.8125rem] text-content-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="rounded font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
