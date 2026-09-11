import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandLogo, Icon } from '@/components/ui/icon';

/**
 * Auth layout.
 *
 * Split screen: the form on the left at a comfortable reading width, and a
 * branded panel on the right that carries the product's promise. The panel is
 * hidden below `lg` — on a phone the form is the only thing that matters, and a
 * decorative column above it would just push the fields off-screen.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1fr] xl:grid-cols-[1fr_1.1fr]">
      {/* ---------- Form column ---------- */}
      <div className="flex flex-col px-5 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="rounded-lg" aria-label="Fast Sold LLC home">
            <BrandLogo size={30} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-content-secondary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
          >
            <Icon name="arrow-left" size={15} />
            Back to site
          </Link>
        </header>

        <main
          id="main-content"
          className="flex flex-1 items-center justify-center py-10 sm:py-14"
        >
          <div className="w-full max-w-[25rem]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-content-tertiary">
          <p>© {new Date().getFullYear()} Fast Sold LLC</p>
          <p className="inline-flex items-center gap-1.5">
            <Icon name="lock" size={12} />
            Your data is isolated from every other business
          </p>
        </footer>
      </div>

      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:block" aria-hidden>
        <div
          className="grid-backdrop absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_70%)]"
        />
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand-500 opacity-20 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-ember-500 opacity-[0.13] blur-3xl" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-brand-300 uppercase">
              Fast Sold LLC
            </p>
            <h2 className="mt-5 max-w-md font-display text-display-sm font-semibold tracking-tight text-white xl:text-display-md">
              Inventory you can reconcile, down to the batch.
            </h2>
            <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-300">
              Stock in opens a dated batch. Stock out consumes the oldest one first. Every change
              appends a ledger line that nothing can edit. That is the whole idea.
            </p>
          </div>

          {/* A compact restatement of the product's guarantees — the thing worth
              reading while signing in. */}
          <ul className="space-y-4">
            {[
              {
                icon: 'layers' as const,
                title: 'True FIFO batch tracking',
                detail: 'Know which receipt satisfied which withdrawal, permanently.',
              },
              {
                icon: 'shield' as const,
                title: 'Stock can never go negative',
                detail: 'Availability is checked inside the write, under a lock.',
              },
              {
                icon: 'history' as const,
                title: 'History cannot be rewritten',
                detail: 'The ledger and audit log are append-only by construction.',
              },
            ].map((point) => (
              <li key={point.title} className="flex gap-3.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand-300 ring-1 ring-white/10">
                  <Icon name={point.icon} size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-semibold text-white">{point.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{point.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-positive-500/20 text-positive-300">
                <Icon name="check-circle" size={15} />
              </span>
              <p className="text-[0.8125rem] font-semibold text-white">
                Multi-tenant from the first line of code
              </p>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-ink-400">
              Your catalogue, ledger, suppliers and users belong to your business alone. Four
              independent layers enforce it, and the test suite proves each one.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
