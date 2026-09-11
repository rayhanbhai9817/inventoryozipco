import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/app/(auth)/login/login-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoadingState } from '@/components/ui/states';

/**
 * The application root is the sign-in page.
 *
 * This is an internal inventory system, not a public product site: there is
 * nothing to market and nobody to sign up, so the front door is the lock.
 *
 * It renders the same `LoginForm` as `/login` rather than reimplementing it —
 * `/login` is kept because the API client redirects there on a 401 and the
 * session-expiry notice is deep-linked with `?expired=1`.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the Fast Sold LLC inventory management system.',
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoadingState label="Loading sign in…" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
