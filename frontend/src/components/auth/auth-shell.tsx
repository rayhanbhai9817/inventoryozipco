import type { ReactNode } from 'react';

import { BrandLogo } from '@/components/ui/brand-logo';

/**
 * The shell around the sign-in experience.
 *
 * Single centred column, no marketing panel, no navigation — the page has one
 * job and every pixel serves it. Used by both `/` and `/login` so there is
 * exactly one login layout and one login form in the codebase.
 *
 * The logo lives in `BrandLogo` — see `components/ui/brand-logo.tsx` for where
 * to drop the brand asset.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-page">
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-6 sm:py-14"
      >
        <div className="w-full max-w-[25rem]">
          <div className="mb-8 flex justify-center">
            <BrandLogo size={34} />
          </div>

          <div className="card-surface p-6 sm:p-8">{children}</div>
        </div>
      </main>

      <footer className="px-5 pb-8 text-center text-xs text-content-tertiary">
        <p>© {new Date().getFullYear()} Ozipco Inventory</p>
      </footer>
    </div>
  );
}
