import type { ReactNode } from 'react';

import { BrandLogo } from '@/components/ui/icon';

/**
 * The shell around the sign-in experience.
 *
 * Single centred column, no marketing panel, no navigation — the page has one
 * job and every pixel serves it. Used by both `/` and `/login` so there is
 * exactly one login layout and one login form in the codebase.
 *
 * ---------------------------------------------------------------------------
 * OZIPCO LOGO GOES HERE
 * ---------------------------------------------------------------------------
 * No Ozipco logo asset exists in this repository, so the current Fast Sold
 * brandmark is rendered as a placeholder rather than a fabricated Ozipco one.
 *
 * To switch to the real logo:
 *   1. Save the file as  frontend/public/brand/ozipco-logo.svg
 *      (SVG preferred; a 2x PNG also works. Transparent background.)
 *   2. Replace the <BrandLogo /> line below with:
 *
 *        <img
 *          src="/brand/ozipco-logo.svg"
 *          alt="Ozipco"
 *          className="mx-auto h-9 w-auto"
 *        />
 *
 * Nothing else needs to change — the spacing around this slot is fixed, so a
 * wordmark of any reasonable aspect ratio will sit correctly.
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
        <p>© {new Date().getFullYear()} Fast Sold LLC · Inventory management</p>
      </footer>
    </div>
  );
}
