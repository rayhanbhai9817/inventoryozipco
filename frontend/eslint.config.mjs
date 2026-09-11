import { FlatCompat } from '@eslint/eslintrc';

/**
 * ESLint flat config.
 *
 * Uses the ESLint CLI rather than `next lint`, which is deprecated in Next 15
 * and removed in 16. `FlatCompat` bridges `eslint-config-next`, which still
 * ships as an eslintrc-style config.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Unused variables are a real smell, but an unused function argument often
      // exists to document a signature. Allow a leading underscore to say so.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];

export default config;
