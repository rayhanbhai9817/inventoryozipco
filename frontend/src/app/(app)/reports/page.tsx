import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Alert, PageHeader } from '@/components/ui/states';
import { REPORTS } from '@/lib/navigation';

export const metadata: Metadata = {
  title: 'Reports',
};

/**
 * The reports index.
 *
 * A server component — the list of reports is static, so there is no reason to
 * ship it as client JavaScript. Each report's own page is interactive.
 */
export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Nine reports over the same data, each filterable by date, product, supplier and category."
      />

      <Alert tone="info" icon="download">
        Every report can be exported as CSV. Export is a separate permission from viewing, because
        reading a report and taking the whole dataset out of the platform are different acts.
      </Alert>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <li key={report.slug}>
            <Link
              href={`/reports/${report.slug}`}
              className="group flex h-full flex-col rounded-2xl bg-surface-card p-5 ring-1 ring-border-subtle transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-border-default"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950 dark:text-brand-300">
                <Icon name={report.icon} size={19} />
              </span>

              <h2 className="mt-4 text-[0.9375rem] font-semibold text-content-primary">
                {report.label}
              </h2>
              <p className="mt-1.5 flex-1 text-[0.8125rem] leading-relaxed text-content-secondary">
                {report.description}
              </p>

              <span className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-brand-600 dark:text-brand-400">
                Open report
                <Icon
                  name="arrow-right"
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader
          title="A note on inventory valuation"
          description="What these reports deliberately do not do."
          icon="info"
        />
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-content-secondary">
          Ozipco Inventory reports on <strong className="text-content-primary">quantities</strong>. Unit
          costs captured at receipt appear in the batch and ledger reports for traceability, and
          reference prices appear in the price history report — but nothing here multiplies a price
          by a quantity to produce an inventory valuation. That is an accounting function, and
          mixing it into a stock system is how the two end up disagreeing.
        </p>
      </Card>
    </div>
  );
}
