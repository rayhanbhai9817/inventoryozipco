import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/app/(auth)/login/login-form';
import { LoadingState } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Ozipco Inventory workspace.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    // The form reads `?expired=1` from the URL, which requires a Suspense
    // boundary under the App Router.
    <Suspense fallback={<LoadingState label="Loading sign in…" />}>
      <LoginForm />
    </Suspense>
  );
}
