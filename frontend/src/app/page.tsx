import type { Metadata } from 'next';

import { DashboardPreview } from '@/components/marketing/dashboard-preview';
import { MarketingNav } from '@/components/marketing/nav';
import {
  FeatureGrid,
  FifoIllustration,
  FinalCta,
  MarketingFooter,
  ModuleRow,
  SectionHeading,
  SectionShell,
  SecurityPoints,
  StockFlowExplainer,
  WorkflowSteps,
  type FeatureEntry,
} from '@/components/marketing/sections';
import {
  LedgerVisual,
  ProductTableVisual,
  ReportsVisual,
  RolesVisual,
  SupplierVisual,
} from '@/components/marketing/visuals';
import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = {
  title: 'Inventory management that knows where every unit came from',
  description:
    'Fast Sold LLC is multi-tenant inventory software for growing businesses: stock in, stock out, FIFO batch tracking, suppliers, reports and an immutable ledger.',
};

const FEATURES: FeatureEntry[] = [
  {
    icon: 'boxes',
    title: 'Quantity you can trust',
    description:
      'Every number traces back to a dated batch. No mystery totals, no spreadsheet that disagrees with the shelf.',
    highlight: true,
  },
  {
    icon: 'layers',
    title: 'True FIFO batches',
    description:
      'Withdrawals consume the oldest stock first, and the record of which batch satisfied which order is kept permanently.',
    highlight: true,
  },
  {
    icon: 'truck',
    title: 'Suppliers, properly linked',
    description:
      'A product can come from several suppliers and a supplier can serve many products. Each receipt remembers which one.',
  },
  {
    icon: 'alert-triangle',
    title: 'Low-stock alerts',
    description:
      'Set a minimum per product. Fast Sold tells you what is running low and what has run out, without you going looking.',
  },
  {
    icon: 'activity',
    title: 'Reports that answer questions',
    description:
      'Movement by product, activity by supplier, the ledger in full — filtered by date, category or SKU, exportable as CSV.',
  },
  {
    icon: 'history',
    title: 'An audit trail you cannot edit',
    description:
      'Who changed what, when, and what the values were before. Append-only, so it still stands up months later.',
  },
  {
    icon: 'shield',
    title: 'Roles that fit your team',
    description:
      'Owner, Manager and Staff out of the box, with a permission matrix you can tune and per-person exceptions.',
  },
  {
    icon: 'file-text',
    title: 'Reference pricing, kept separate',
    description:
      'Track list prices and their history without letting them anywhere near your quantities. Pricing informs; it never moves stock.',
  },
  {
    icon: 'lock',
    title: 'One business, one dataset',
    description:
      'Multi-tenant from the first line of code. Your catalogue, ledger and users are isolated from every other business.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-surface-page">
      <MarketingNav />

      <main id="main-content">
        {/* ================================================================
            Hero
            ================================================================ */}
        <section className="relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24">
          {/* Layered backdrop: a faint grid, a soft brand bloom, both masked so
              they fade out rather than ending in a hard edge. */}
          <div
            className="grid-backdrop absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_80%_55%_at_50%_0%,black,transparent)]"
            aria-hidden
          />
          <div
            className="absolute -top-40 left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-300 via-brand-200 to-ember-200 opacity-25 blur-3xl dark:from-brand-700 dark:via-brand-800 dark:to-ember-900 dark:opacity-20"
            aria-hidden
          />

          <div className="container-page relative">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full bg-surface-card px-3 py-1.5 text-xs font-medium text-content-secondary ring-1 ring-border-subtle">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Icon name="zap" size={9} />
                </span>
                Multi-tenant inventory management
              </p>

              <h1 className="mt-6 font-display text-display-md font-semibold tracking-tight text-content-primary sm:text-display-xl">
                Know exactly what you hold,
                <br className="hidden sm:block" />{' '}
                <span className="text-gradient-brand">and where it came from</span>
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-content-secondary sm:text-lg">
                Fast Sold LLC is inventory software for businesses that have outgrown the
                spreadsheet. Record stock in and stock out, consume the oldest batch first, and keep
                a ledger that cannot be quietly rewritten.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/register" size="lg" trailingIcon="arrow-right">
                  Get started free
                </ButtonLink>
                <ButtonLink href="/login" size="lg" variant="secondary">
                  Sign in
                </ButtonLink>
              </div>

              <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-content-tertiary">
                {[
                  'No credit card required',
                  'Your data stays isolated',
                  'Set up in under five minutes',
                ].map((point) => (
                  <li key={point} className="inline-flex items-center gap-1.5">
                    <Icon
                      name="check-circle"
                      size={14}
                      className="text-positive-600 dark:text-positive-400"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Product preview — the promise made concrete. */}
            <div className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
              <div
                className="absolute -inset-x-6 -top-4 bottom-8 rounded-[2rem] bg-gradient-to-b from-brand-500/10 to-transparent blur-2xl"
                aria-hidden
              />
              <DashboardPreview className="relative" />
              {/* Fades the bottom of the screenshot into the page, so it reads as
                  a window rather than a pasted rectangle. */}
              <div
                className="pointer-events-none absolute inset-x-0 -bottom-1 h-24 bg-gradient-to-t from-surface-page to-transparent"
                aria-hidden
              />
            </div>
          </div>
        </section>

        {/* ================================================================
            Stock IN / Stock OUT
            ================================================================ */}
        <SectionShell id="engine" tone="sunken">
          <div className="container-page">
            <SectionHeading
              eyebrow="The two movements that matter"
              title="Stock in, stock out, and nothing fuzzy in between"
              description="Inventory is a quantity problem. Fast Sold treats it as one — precisely, transactionally, and with a record of every unit's provenance."
            />

            <div className="mt-12">
              <StockFlowExplainer />
            </div>

            <div className="mx-auto mt-12 max-w-3xl">
              <FifoIllustration />
            </div>
          </div>
        </SectionShell>

        {/* ================================================================
            Feature grid
            ================================================================ */}
        <SectionShell id="features">
          <div className="container-page">
            <SectionHeading
              eyebrow="Everything included"
              title="A complete inventory platform, not a stock counter"
              description="Products, categories, suppliers, batches, the ledger, reports, notifications, audit history and role-based access — all of it from day one."
            />

            <div className="mt-12">
              <FeatureGrid features={FEATURES} />
            </div>
          </div>
        </SectionShell>

        {/* ================================================================
            Module showcase
            ================================================================ */}
        <SectionShell id="modules" tone="sunken">
          <div className="container-page space-y-20 sm:space-y-28">
            <SectionHeading
              eyebrow="Inside the product"
              title="Built around how inventory actually works"
              description="Each module does one job well, and they share the same data — so a product's suppliers, batches, movements and price history all sit one click apart."
            />

            <ModuleRow
              eyebrow="Product catalogue"
              title="Your catalogue, with stock health on every row"
              description="SKUs, units of measure, barcodes, minimum levels and categories. Search, filter and sort the way you think about your stock, then open a product to see its whole story."
              points={[
                'Per-product minimum levels drive the low-stock alerts',
                'Units of measure from each to pallets, grams to metres',
                'Archive retired products without losing their history',
                'Product detail shows batches, movements, suppliers and price history together',
              ]}
              visual={<ProductTableVisual />}
            />

            <ModuleRow
              reverse
              eyebrow="Suppliers"
              title="Know who supplied the units on your shelf"
              description="Suppliers are linked to products many-to-many, and every receipt records which supplier it came from. When a batch turns out to be faulty, you know exactly whose it was."
              points={[
                'Several suppliers per product, several products per supplier',
                'A preferred supplier per product, with lead time and minimum order',
                'Supplier pages show units supplied, batches and full receipt history',
                'Deactivate a supplier without breaking the batches they supplied',
              ]}
              visual={<SupplierVisual />}
            />

            <ModuleRow
              eyebrow="Reports"
              title="Nine reports, one filter bar, CSV when you need it"
              description="Inventory summary, stock in, stock out, combined movement, low stock, out of stock, supplier activity, the full ledger and price reference history."
              points={[
                'Filter by date range, product, supplier and category',
                'Sort and paginate without waiting on a spinner',
                'Export to CSV — a separate permission from viewing',
                'Totals above every table, so the headline number is never a mental sum',
              ]}
              visual={<ReportsVisual />}
            />

            <ModuleRow
              reverse
              eyebrow="Inventory ledger"
              title="A record that cannot be rewritten"
              description="Every quantity change appends a ledger line with the product, the batch, the signed change, the balance after and who did it. Nothing in the application can edit or delete one."
              points={[
                'Append-only by construction, not by convention',
                'Running balance on every line, so totals reconcile',
                'Corrections are recorded as adjustments, with a mandatory reason',
                'Filter the whole ledger or read one product’s timeline',
              ]}
              visual={<LedgerVisual />}
            />

            <ModuleRow
              eyebrow="Roles & permissions"
              title="Give people exactly the access they need"
              description="Three roles to start, a permission matrix you can tune for your business, and per-person exceptions when someone needs one more thing — or one less."
              points={[
                'Owner, Manager and Staff, each with sensible defaults',
                'Adjust what Managers and Staff can do, per business',
                'Grant or revoke a single permission for one person',
                'Every check is enforced server-side, on every request',
              ]}
              visual={<RolesVisual />}
            />
          </div>
        </SectionShell>

        {/* ================================================================
            Workflow
            ================================================================ */}
        <SectionShell id="workflow">
          <div className="container-page">
            <SectionHeading
              eyebrow="Getting going"
              title="Five steps from signup to a real ledger"
              description="No implementation project, no data migration workshop. Create your business and start recording movements the same afternoon."
            />

            <div className="mt-14">
              <WorkflowSteps />
            </div>
          </div>
        </SectionShell>

        {/* ================================================================
            Security
            ================================================================ */}
        <SectionShell id="security" tone="ink">
          <div className="container-page">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <SectionHeading
                  inverse
                  align="left"
                  eyebrow="Security & reliability"
                  title="The guarantees, written down"
                  description="These are not aspirations. Each one is enforced in the backend and covered by an automated test, because an inventory system that is occasionally wrong is worse than no system at all."
                />

                <dl className="mt-8 grid grid-cols-2 gap-6">
                  {[
                    ['4', 'independent layers of tenant isolation'],
                    ['0', 'paths that can drive stock negative'],
                    ['1', 'transaction per inventory change'],
                    ['60', 'automated tests on the rules above'],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <dt className="font-display text-display-sm font-semibold text-white tabular-nums">
                        {value}
                      </dt>
                      <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-400">{label}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <SecurityPoints />
            </div>
          </div>
        </SectionShell>

        {/* ================================================================
            Final CTA
            ================================================================ */}
        <section className="py-20 sm:py-24">
          <div className="container-page">
            <FinalCta />
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
