import Link from 'next/link';
import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { BrandLogo, Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Shared marketing primitives
   ========================================================================== */

export function SectionShell({
  id,
  children,
  className,
  tone = 'page',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: 'page' | 'sunken' | 'ink';
}) {
  const tones = {
    page: '',
    sunken: 'bg-surface-sunken/60',
    ink: 'bg-ink-950 text-ink-100',
  };

  return (
    <section
      id={id}
      className={cn('scroll-mt-20 py-20 sm:py-28', tones[tone], className)}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  inverse = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'center' | 'left';
  inverse?: boolean;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p
          className={cn(
            'mb-3 text-xs font-semibold tracking-[0.14em] uppercase',
            inverse ? 'text-brand-300' : 'text-brand-600 dark:text-brand-400',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'font-display text-display-sm font-semibold tracking-tight sm:text-display-md',
          inverse ? 'text-white' : 'text-content-primary',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-4 text-base leading-relaxed sm:text-lg',
            inverse ? 'text-ink-300' : 'text-content-secondary',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Feature grid
   ========================================================================== */

export interface FeatureEntry {
  icon: IconName;
  title: string;
  description: string;
  /** Marks the one or two cards that should draw the eye. */
  highlight?: boolean;
}

export function FeatureGrid({ features }: { features: FeatureEntry[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <li
          key={feature.title}
          className={cn(
            'group relative overflow-hidden rounded-2xl bg-surface-card p-5 ring-1 ring-border-subtle transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-border-default',
            feature.highlight && 'ring-brand-200 dark:ring-brand-800',
          )}
        >
          {feature.highlight ? (
            <span
              className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br from-brand-400 to-transparent opacity-[0.08]"
              aria-hidden
            />
          ) : null}

          <span
            className={cn(
              'relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
              feature.highlight
                ? 'bg-brand-600 text-white'
                : 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300',
            )}
          >
            <Icon name={feature.icon} size={19} />
          </span>

          <h3 className="relative mt-4 text-[0.9375rem] font-semibold text-content-primary">
            {feature.title}
          </h3>
          <p className="relative mt-1.5 text-[0.8125rem] leading-relaxed text-content-secondary">
            {feature.description}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ==========================================================================
   Stock IN / Stock OUT explainer
   ========================================================================== */

export function StockFlowExplainer() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <FlowCard
        tone="in"
        icon="arrow-down-right"
        label="Stock IN"
        title="Every receipt opens a batch"
        description="Record what arrived, from which supplier, against which purchase order. Fast Sold opens a dated batch so you always know where a unit came from — not just how many you hold."
        points={[
          'Supplier and reference attached to the batch, not just the total',
          'Optional unit cost captured for traceability',
          'Quantity on hand updates in the same transaction',
          'One immutable ledger line, with the new balance',
        ]}
      />
      <FlowCard
        tone="out"
        icon="arrow-up-right"
        label="Stock OUT"
        title="Oldest batch leaves first"
        description="Ask for 25 units and Fast Sold works out which batches they come from — oldest first — then records exactly how much came from each. Availability is re-checked at the moment of writing, so stock cannot go negative."
        points={[
          'True FIFO consumption, decided in the backend',
          'Refused with the real available quantity if there is not enough',
          'Which batch satisfied which withdrawal is kept, permanently',
          'Preview the allocation before you commit',
        ]}
      />
    </div>
  );
}

function FlowCard({
  tone,
  icon,
  label,
  title,
  description,
  points,
}: {
  tone: 'in' | 'out';
  icon: IconName;
  label: string;
  title: string;
  description: string;
  points: string[];
}) {
  const tones = {
    in: {
      chip: 'bg-positive-50 text-positive-700 ring-positive-500/20 dark:bg-positive-700/15 dark:text-positive-100',
      glyph: 'bg-positive-500',
      check: 'text-positive-600 dark:text-positive-400',
    },
    out: {
      chip: 'bg-info-50 text-info-700 ring-info-500/20 dark:bg-info-700/15 dark:text-info-100',
      glyph: 'bg-info-500',
      check: 'text-info-600 dark:text-info-400',
    },
  };

  const tokens = tones[tone];

  return (
    <div className="flex flex-col rounded-2xl bg-surface-card p-6 ring-1 ring-border-subtle">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-xl text-white',
            tokens.glyph,
          )}
        >
          <Icon name={icon} size={19} />
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[0.6875rem] font-bold tracking-wider uppercase ring-1 ring-inset',
            tokens.chip,
          )}
        >
          {label}
        </span>
      </div>

      <h3 className="mt-5 font-display text-xl font-semibold text-content-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary">{description}</p>

      <ul className="mt-5 space-y-2.5 border-t border-border-subtle pt-5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-[0.8125rem] text-content-secondary">
            <Icon name="check" size={15} className={cn('mt-0.5 shrink-0', tokens.check)} />
            <span className="leading-relaxed">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   FIFO illustration
   ========================================================================== */

/**
 * A worked FIFO example. Concrete numbers do more to explain the engine than any
 * amount of prose about "first in, first out".
 */
export function FifoIllustration() {
  const batches = [
    { number: 'IN-DRL18-0021', received: '3 Jul', held: 40, taken: 40, supplier: 'Northwind Industrial' },
    { number: 'IN-DRL18-0034', received: '31 Jul', held: 32, taken: 10, supplier: 'Cascade Hardware' },
    { number: 'IN-DRL18-0048', received: '27 Aug', held: 28, taken: 0, supplier: 'Northwind Industrial' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-card ring-1 ring-border-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-sunken/60 px-5 py-3.5">
        <div>
          <p className="text-[0.8125rem] font-semibold text-content-primary">
            Withdrawing 50 units of FS-DRL-1801
          </p>
          <p className="mt-0.5 text-xs text-content-tertiary">
            100 on hand across 3 open batches
          </p>
        </div>
        <span className="rounded-full bg-info-50 px-2.5 py-1 text-[0.6875rem] font-semibold text-info-700 ring-1 ring-info-500/20 ring-inset dark:bg-info-700/15 dark:text-info-100">
          FIFO allocation
        </span>
      </div>

      <ul className="divide-y divide-border-subtle">
        {batches.map((batch, index) => {
          const remaining = batch.held - batch.taken;
          const consumedRatio = batch.taken / batch.held;

          return (
            <li key={batch.number} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.625rem] font-bold',
                      batch.taken > 0
                        ? 'bg-info-600 text-white'
                        : 'bg-ink-100 text-content-tertiary dark:bg-surface-raised',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="font-mono text-xs text-content-primary">{batch.number}</span>
                  <span className="text-xs text-content-tertiary">received {batch.received}</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-content-primary">
                  {batch.taken > 0 ? (
                    <>
                      taking <span className="text-info-600 dark:text-info-300">{batch.taken}</span> of{' '}
                      {batch.held}
                    </>
                  ) : (
                    <span className="text-content-tertiary">untouched — {batch.held} held</span>
                  )}
                </span>
              </div>

              <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-info-500 transition-[width] duration-700"
                  style={{ width: `${consumedRatio * 100}%` }}
                />
              </div>

              <p className="mt-1.5 text-[0.6875rem] text-content-tertiary">
                {batch.supplier} · {remaining} remaining after this withdrawal
              </p>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-sunken/60 px-5 py-3.5">
        <p className="text-xs text-content-secondary">
          Three ledger lines written, balance{' '}
          <span className="font-semibold tabular-nums text-content-primary">100 → 50</span>
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-positive-700 dark:text-positive-300">
          <Icon name="shield" size={14} />
          One transaction, never negative
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   Workflow steps
   ========================================================================== */

export function WorkflowSteps() {
  const steps = [
    {
      icon: 'building' as IconName,
      title: 'Create your business',
      description:
        'Sign up and your workspace exists in seconds. You become the Owner, with your own isolated catalogue, ledger and audit trail.',
    },
    {
      icon: 'package' as IconName,
      title: 'Add products and suppliers',
      description:
        'Build your catalogue with SKUs, units and minimum levels. Link each product to the suppliers you buy it from — several each way.',
    },
    {
      icon: 'arrow-down-right' as IconName,
      title: 'Record what arrives',
      description:
        'Each receipt opens a dated batch with its supplier and reference attached, and updates your quantity on hand.',
    },
    {
      icon: 'arrow-up-right' as IconName,
      title: 'Record what leaves',
      description:
        'Ask for a quantity. Fast Sold consumes the oldest batches first and keeps the record of exactly which ones.',
    },
    {
      icon: 'activity' as IconName,
      title: 'Read the numbers',
      description:
        'Low-stock alerts, supplier activity, movement history and a ledger you can reconcile — exportable when you need it elsewhere.',
    },
  ];

  return (
    <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
      {steps.map((step, index) => (
        <li key={step.title} className="relative">
          {/* Connector between steps on wide screens. */}
          {index < steps.length - 1 ? (
            <span
              className="absolute top-5 left-[calc(50%+1.75rem)] hidden h-px w-[calc(100%-3.5rem)] bg-gradient-to-r from-border-default to-transparent lg:block"
              aria-hidden
            />
          ) : null}

          <div className="flex items-start gap-4 lg:flex-col lg:items-start">
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-card text-brand-600 ring-1 ring-border-subtle dark:text-brand-300">
              <Icon name={step.icon} size={18} />
              <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[0.625rem] font-bold text-white">
                {index + 1}
              </span>
            </span>
            <div className="min-w-0 lg:mt-4">
              <h3 className="text-[0.875rem] font-semibold text-content-primary">{step.title}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-content-secondary">
                {step.description}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ==========================================================================
   Security
   ========================================================================== */

export function SecurityPoints() {
  const points = [
    {
      icon: 'lock' as IconName,
      title: 'Your data is yours alone',
      description:
        'Every record belongs to your business, and the tenant is taken from your own account — never from anything a browser can change. Four independent layers enforce it, and the test suite proves each one.',
    },
    {
      icon: 'shield' as IconName,
      title: 'Permissions that actually hold',
      description:
        'Owner, Manager and Staff, with a permission matrix you can tune. Every check happens on the server, so hiding a button is a courtesy rather than the control.',
    },
    {
      icon: 'history' as IconName,
      title: 'History you cannot rewrite',
      description:
        'The inventory ledger and the audit log are append-only by construction. Corrections are recorded as adjustments, so the trail stays intact for a stock audit.',
    },
    {
      icon: 'refresh' as IconName,
      title: 'Consistent under pressure',
      description:
        'Inventory changes run in a single transaction with the row locked. Two simultaneous withdrawals cannot both spend the same stock, and a failure part-way through leaves nothing behind.',
    },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {points.map((point) => (
        <li
          key={point.title}
          className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 backdrop-blur-sm"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Icon name={point.icon} size={19} />
          </span>
          <h3 className="mt-4 text-[0.9375rem] font-semibold text-white">{point.title}</h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-300">{point.description}</p>
        </li>
      ))}
    </ul>
  );
}

/* ==========================================================================
   Module showcase — two-column alternating rows
   ========================================================================== */

export function ModuleRow({
  eyebrow,
  title,
  description,
  points,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={cn('min-w-0', reverse && 'lg:order-2')}>
        <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-brand-600 uppercase dark:text-brand-400">
          {eyebrow}
        </p>
        <h3 className="font-display text-display-xs font-semibold text-content-primary sm:text-display-sm">
          {title}
        </h3>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-content-secondary">{description}</p>
        <ul className="mt-5 space-y-2.5">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-[0.8125rem]">
              <Icon
                name="check-circle"
                size={16}
                className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400"
              />
              <span className="leading-relaxed text-content-secondary">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn('min-w-0', reverse && 'lg:order-1')}>{visual}</div>
    </div>
  );
}

/* ==========================================================================
   Final CTA
   ========================================================================== */

export function FinalCta() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 px-6 py-14 text-center sm:px-12 sm:py-20">
      <div
        className="grid-backdrop absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
        aria-hidden
      />
      <div
        className="absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-ember-500 opacity-20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-2xl">
        <h2 className="font-display text-display-sm font-semibold tracking-tight text-white sm:text-display-md">
          Start counting what you actually hold
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-300">
          Create your workspace, add your first products, and record a receipt. You will have a real
          inventory ledger before your coffee goes cold.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/register" size="lg" trailingIcon="arrow-right">
            Create your business
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="inverse">
            Sign in
          </ButtonLink>
        </div>

        <p className="mt-6 text-xs text-ink-400">
          No credit card required · Your data stays isolated from every other business
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   Footer
   ========================================================================== */

export function MarketingFooter() {
  const columns = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Inventory engine', href: '#engine' },
        { label: 'How it works', href: '#workflow' },
        { label: 'Security', href: '#security' },
      ],
    },
    {
      title: 'Modules',
      links: [
        { label: 'Products & categories', href: '#modules' },
        { label: 'Suppliers', href: '#modules' },
        { label: 'Reports', href: '#modules' },
        { label: 'Audit log', href: '#modules' },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Sign in', href: '/login' },
        { label: 'Create a business', href: '/register' },
      ],
    },
  ];

  return (
    <footer className="border-t border-border-subtle bg-surface-sunken/40">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Link href="/" className="inline-block rounded-lg" aria-label="Fast Sold LLC home">
              <BrandLogo size={30} />
            </Link>
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-content-secondary">
              Inventory management for businesses that need to know exactly what they hold, where it
              came from, and what moved — with FIFO batch tracking and a ledger that cannot be
              rewritten.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold tracking-wide text-content-primary uppercase">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    {link.href.startsWith('/') ? (
                      <Link
                        href={link.href}
                        className="rounded text-[0.8125rem] text-content-secondary transition-colors hover:text-content-primary"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="rounded text-[0.8125rem] text-content-secondary transition-colors hover:text-content-primary"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-content-tertiary">
            © {new Date().getFullYear()} Fast Sold LLC. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-content-tertiary">
            <Icon name="boxes" size={13} />
            Built for inventory, not for guesswork
          </p>
        </div>
      </div>
    </footer>
  );
}
