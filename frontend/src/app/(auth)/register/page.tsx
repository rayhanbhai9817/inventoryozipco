import type { Metadata } from 'next';

import { RegisterForm } from '@/app/(auth)/register/register-form';

export const metadata: Metadata = {
  title: 'Create your business',
  description:
    'Create a Fast Sold LLC inventory workspace for your business. No credit card required.',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
