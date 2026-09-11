'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, PasswordInput } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Alert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { DEMO_MODE } from '@/lib/data-source';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState(DEMO_MODE ? 'owner@fastsold.test' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'Demo-Password-42' : '');
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const sessionExpired = searchParams.get('expired') === '1';
  const redirectTo = searchParams.get('next') ?? '/dashboard';

  // Already signed in? Go straight through rather than showing a form they do
  // not need.
  useEffect(() => {
    if (status === 'authenticated') router.replace(redirectTo);
  }, [status, router, redirectTo]);

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = 'Enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'That does not look like an email address.';
    }

    if (!password) errors.password = 'Enter your password.';

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      await login({ email: email.trim(), password, remember, device_name: 'web' });
      toast.success('Welcome back', 'Signed in successfully.');
      router.replace(redirectTo);
    } catch (error) {
      if (error instanceof ApiError) {
        // Laravel returns the credential failure under `email`; surface it as a
        // form-level message since it is not really about that one field.
        const emailError = error.fieldError('email');

        if (error.isValidation && emailError) {
          setFormError(emailError);
        } else if (error.isRateLimited) {
          setFormError('Too many attempts. Please wait a moment and try again.');
        } else {
          setFormError(error.message);
          setFieldErrors({
            email: error.fieldError('email'),
            password: error.fieldError('password'),
          });
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
          Sign in to Fast Sold
        </h1>
        <p className="mt-2 text-sm text-content-secondary">
          Welcome back. Enter your details to reach your inventory.
        </p>
      </header>

      {sessionExpired ? (
        <Alert tone="caution" className="mt-6" title="Your session expired">
          For your security you were signed out. Please sign in again to continue.
        </Alert>
      ) : null}

      {DEMO_MODE ? (
        <Alert tone="brand" className="mt-6" title="Demo workspace" icon="sparkles">
          This build runs on bundled demo data, so any credentials will get you in. The fields are
          pre-filled.
        </Alert>
      ) : null}

      {formError ? (
        <Alert tone="critical" className="mt-6" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
        <Field label="Email address" error={fieldErrors.email} required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            icon="mail"
            size="lg"
            placeholder="you@yourbusiness.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            autoFocus={!DEMO_MODE}
          />
        </Field>

        <Field
          label="Password"
          error={fieldErrors.password}
          required
          labelAccessory={
            <Link
              href="/forgot-password"
              className="rounded font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            name="password"
            autoComplete="current-password"
            size="lg"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
          />
        </Field>

        <Checkbox
          name="remember"
          label="Keep me signed in for 30 days"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          disabled={submitting}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting} trailingIcon="arrow-right">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-7 text-center text-[0.8125rem] text-content-secondary">
        New to Fast Sold?{' '}
        <Link
          href="/register"
          className="rounded font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
        >
          Create your business
        </Link>
      </p>

      <div className="mt-8 flex items-start gap-2.5 rounded-xl bg-surface-sunken/70 p-3.5 text-xs leading-relaxed text-content-tertiary">
        <Icon name="shield" size={15} className="mt-px shrink-0" />
        <p>
          Sign-in attempts are rate limited and recorded in your business&rsquo;s audit log, so you
          can see who accessed your inventory and when.
        </p>
      </div>
    </div>
  );
}
