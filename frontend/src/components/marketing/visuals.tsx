import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Small, composed product visuals for the module showcase rows.
 *
 * Like the dashboard preview, these are built from the design system rather than
 * captured as images: they scale, they theme, and they cannot go stale relative
 * to the real interface.
 */

/* -------------------------------------------------------------------------- */
/* Product catalogue                                                          */
/* -------------------------------------------------------------------------- */

export function ProductTableVisual() {
  const rows = [
    { sku: 'FS-DRL-1801', name: '18V Brushless Drill Driver', category: 'Power Tools', colour: '#137E87', qty: 50, min: 8, status: 'ok' },
    { sku: 'FS-DRL-1802', name: '18V Impact Driver', category: 'Power Tools', colour: '#137E87', qty: 3, min: 6, status: 'low' },
    { sku: 'FS-BLT-M8', name: 'M8 Hex Bolt, Zinc', category: 'Fasteners', colour: '#FF5A1F', qty: 68, min: 20, status: 'ok' },
    { sku: 'FS-VST-HIV', name: 'Hi-Vis Vest, Class 2', category: 'Safety', colour: '#6366F1', qty: 0, min: 25, status: 'out' },
    { sku: 'FS-SKT-DBL', name: 'Double Socket Outlet', category: 'Electrical', colour: '#0EA5A4', qty: 142, min: 25, status: 'ok' },
  ];

  return (
    <VisualFrame title="Products" meta="22 items · 1,486 units">
      <table className="w-full text-[0.6875rem]">
        <thead>
          <tr className="bg-surface-sunken/50 text-content-tertiary">
            <th className="px-3 py-2 text-left font-semibold">Product</th>
            <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">Category</th>
            <th className="px-3 py-2 text-right font-semibold">On hand</th>
            <th className="px-3 py-2 text-right font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={row.sku} className="border-t border-border-subtle/70">
              <td className="px-3 py-2">
                <span className="block truncate font-medium text-content-primary">{row.name}</span>
                <span className="font-mono text-[0.5625rem] text-content-tertiary">{row.sku}</span>
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.5625rem] font-medium"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${row.colour} 12%, transparent)`,
                    color: `color-mix(in oklab, ${row.colour} 72%, var(--text-primary))`,
                  }}
                >
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: row.colour }} />
                  {row.category}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-semibold text-content-primary">
                {row.qty}
                <span className="ml-1 text-[0.5625rem] font-normal text-content-tertiary">
                  / {row.min} min
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <StatusPill status={row.status as 'ok' | 'low' | 'out'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </VisualFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Supplier relationships                                                     */
/* -------------------------------------------------------------------------- */

export function SupplierVisual() {
  return (
    <VisualFrame title="Northwind Industrial" meta="NWI · 7 day lead time">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Products" value="6" />
          <MiniStat label="Batches" value="18" />
          <MiniStat label="Units supplied" value="742" />
        </div>

        <div>
          <p className="mb-2 text-[0.625rem] font-semibold tracking-wide text-content-tertiary uppercase">
            Products supplied
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              '18V Drill Driver',
              'Impact Driver',
              '7¼in Circular Saw',
              '250mm Spanner',
              'Combination Pliers',
              '5m Tape Measure',
            ].map((name, index) => (
              <span
                key={name}
                className={cn(
                  'rounded-full px-2 py-1 text-[0.5625rem] font-medium ring-1 ring-inset',
                  index === 0
                    ? 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-800'
                    : 'bg-surface-sunken text-content-secondary ring-border-subtle',
                )}
              >
                {index === 0 ? '★ ' : ''}
                {name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[0.625rem] font-semibold tracking-wide text-content-tertiary uppercase">
            Recent batches
          </p>
          <div className="space-y-1.5">
            {[
              { batch: 'IN-FSDRL1-0048', date: '27 Aug', qty: 28, remaining: 28 },
              { batch: 'IN-FSDRL1-0034', date: '31 Jul', qty: 32, remaining: 22 },
              { batch: 'IN-FSDRL1-0021', date: '3 Jul', qty: 40, remaining: 0 },
            ].map((entry) => (
              <div
                key={entry.batch}
                className="flex items-center gap-2 rounded-lg bg-surface-sunken/60 px-2.5 py-1.5"
              >
                <span className="font-mono text-[0.5625rem] text-content-secondary">
                  {entry.batch}
                </span>
                <span className="text-[0.5625rem] text-content-tertiary">{entry.date}</span>
                <span className="ml-auto text-[0.5625rem] font-semibold tabular-nums text-content-primary">
                  {entry.remaining} / {entry.qty}
                </span>
                {entry.remaining === 0 ? (
                  <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[0.5rem] font-semibold text-content-tertiary dark:bg-surface-raised">
                    depleted
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export function ReportsVisual() {
  const reports: Array<{ label: string; icon: IconName; rows: string }> = [
    { label: 'Inventory summary', icon: 'boxes', rows: '22 rows' },
    { label: 'Stock in', icon: 'arrow-down-right', rows: '66 rows' },
    { label: 'Stock out', icon: 'arrow-up-right', rows: '61 rows' },
    { label: 'Low stock', icon: 'alert-triangle', rows: '3 rows' },
    { label: 'Supplier activity', icon: 'truck', rows: '5 rows' },
    { label: 'Inventory ledger', icon: 'layers', rows: '120 rows' },
  ];

  return (
    <VisualFrame title="Reports" meta="Filter, sort, export">
      <div className="grid grid-cols-2 gap-2 p-4">
        {reports.map((report, index) => (
          <div
            key={report.label}
            className={cn(
              'rounded-lg p-2.5 ring-1 ring-inset transition-colors',
              index === 3
                ? 'bg-caution-50 ring-caution-500/25 dark:bg-caution-700/15'
                : 'bg-surface-sunken/60 ring-border-subtle',
            )}
          >
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-md',
                index === 3
                  ? 'bg-caution-500 text-white'
                  : 'bg-surface-card text-brand-600 ring-1 ring-border-subtle dark:text-brand-300',
              )}
            >
              <Icon name={report.icon} size={11} />
            </span>
            <p className="mt-2 text-[0.625rem] leading-tight font-semibold text-content-primary">
              {report.label}
            </p>
            <p className="mt-0.5 text-[0.5625rem] tabular-nums text-content-tertiary">{report.rows}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle bg-surface-sunken/50 px-4 py-2.5">
        <span className="text-[0.5625rem] text-content-tertiary">
          Date · product · supplier · category filters
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-surface-card px-2 py-1 text-[0.5625rem] font-semibold text-content-secondary ring-1 ring-border-subtle">
          <Icon name="download" size={9} />
          Export CSV
        </span>
      </div>
    </VisualFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Roles and permissions                                                      */
/* -------------------------------------------------------------------------- */

export function RolesVisual() {
  const matrix = [
    { permission: 'View inventory', owner: true, manager: true, staff: true },
    { permission: 'Record stock in / out', owner: true, manager: true, staff: true },
    { permission: 'Manage products', owner: true, manager: true, staff: false },
    { permission: 'Manage suppliers', owner: true, manager: true, staff: false },
    { permission: 'Adjust inventory', owner: true, manager: true, staff: false },
    { permission: 'Export reports', owner: true, manager: true, staff: false },
    { permission: 'Manage users', owner: true, manager: false, staff: false },
    { permission: 'View audit log', owner: true, manager: false, staff: false },
  ];

  return (
    <VisualFrame title="Roles & permissions" meta="Tune per business">
      <table className="w-full text-[0.625rem]">
        <thead>
          <tr className="bg-surface-sunken/50 text-content-tertiary">
            <th className="px-3 py-2 text-left font-semibold">Permission</th>
            <th className="px-2 py-2 text-center font-semibold">Owner</th>
            <th className="px-2 py-2 text-center font-semibold">Manager</th>
            <th className="px-2 py-2 text-center font-semibold">Staff</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.permission} className="border-t border-border-subtle/70">
              <td className="px-3 py-1.5 text-content-primary">{row.permission}</td>
              {[row.owner, row.manager, row.staff].map((granted, index) => (
                <td key={index} className="px-2 py-1.5 text-center">
                  {granted ? (
                    <Icon
                      name="check"
                      size={12}
                      strokeWidth={2.5}
                      className="mx-auto text-positive-600 dark:text-positive-400"
                    />
                  ) : (
                    <Icon name="minus" size={12} className="mx-auto text-ink-300 dark:text-ink-700" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-subtle bg-surface-sunken/50 px-3 py-2 text-[0.5625rem] text-content-tertiary">
        Owners always hold everything. Manager and Staff are yours to adjust, with per-person
        exceptions.
      </p>
    </VisualFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Ledger                                                                     */
/* -------------------------------------------------------------------------- */

export function LedgerVisual() {
  const entries = [
    { date: '10 Sep 11:42', type: 'out', product: 'FS-GOG-CLR', change: '−18', balance: 126, batch: 'IN-FSGOG-0031', user: 'MO' },
    { date: '08 Sep 14:30', type: 'out', product: 'FS-BLT-M8', change: '−22', balance: 68, batch: 'IN-FSBLTM-0013', user: 'MO' },
    { date: '06 Sep 11:05', type: 'adjustment', product: 'FS-GRD-125', change: '−2', balance: 0, batch: 'IN-FSGRD1-0010', user: 'DO' },
    { date: '27 Aug 09:15', type: 'in', product: 'FS-DRL-1801', change: '+28', balance: 100, batch: 'IN-FSDRL1-0048', user: 'PR' },
    { date: '31 Jul 09:15', type: 'in', product: 'FS-DRL-1801', change: '+32', balance: 72, batch: 'IN-FSDRL1-0034', user: 'PR' },
  ];

  return (
    <VisualFrame title="Inventory ledger" meta="Append-only · 120 entries">
      <table className="w-full text-[0.625rem]">
        <thead>
          <tr className="bg-surface-sunken/50 text-content-tertiary">
            <th className="px-3 py-2 text-left font-semibold">When</th>
            <th className="px-2 py-2 text-left font-semibold">Product</th>
            <th className="hidden px-2 py-2 text-left font-semibold sm:table-cell">Batch</th>
            <th className="px-2 py-2 text-right font-semibold">Change</th>
            <th className="px-3 py-2 text-right font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {entries.map((entry, index) => (
            <tr key={index} className="border-t border-border-subtle/70">
              <td className="px-3 py-1.5 whitespace-nowrap text-content-tertiary">{entry.date}</td>
              <td className="px-2 py-1.5 font-mono text-content-primary">{entry.product}</td>
              <td className="hidden px-2 py-1.5 font-mono text-[0.5625rem] text-content-tertiary sm:table-cell">
                {entry.batch}
              </td>
              <td
                className={cn(
                  'px-2 py-1.5 text-right font-semibold',
                  entry.change.startsWith('+')
                    ? 'text-positive-600 dark:text-positive-300'
                    : entry.type === 'adjustment'
                      ? 'text-caution-600 dark:text-caution-300'
                      : 'text-info-600 dark:text-info-300',
                )}
              >
                {entry.change}
              </td>
              <td className="px-3 py-1.5 text-right font-semibold text-content-primary">
                {entry.balance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex items-center gap-1.5 border-t border-border-subtle bg-surface-sunken/50 px-3 py-2 text-[0.5625rem] text-content-tertiary">
        <Icon name="lock" size={9} />
        Entries can never be edited or deleted — corrections are recorded as adjustments
      </p>
    </VisualFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared chrome                                                              */
/* -------------------------------------------------------------------------- */

function VisualFrame({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl bg-surface-card shadow-lg ring-1 ring-border-subtle"
      aria-hidden
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-sunken/60 px-4 py-2.5">
        <p className="text-[0.6875rem] font-semibold text-content-primary">{title}</p>
        {meta ? <p className="text-[0.5625rem] text-content-tertiary">{meta}</p> : null}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-sunken/60 p-2 text-center ring-1 ring-border-subtle ring-inset">
      <p className="font-display text-sm leading-none font-semibold tabular-nums text-content-primary">
        {value}
      </p>
      <p className="mt-1 text-[0.5rem] tracking-wide text-content-tertiary uppercase">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: 'ok' | 'low' | 'out' }) {
  const tokens = {
    ok: { label: 'In stock', className: 'bg-positive-50 text-positive-700 dark:bg-positive-700/20 dark:text-positive-200' },
    low: { label: 'Low', className: 'bg-caution-50 text-caution-700 dark:bg-caution-700/20 dark:text-caution-200' },
    out: { label: 'Out', className: 'bg-critical-50 text-critical-700 dark:bg-critical-700/20 dark:text-critical-200' },
  };

  return (
    <span
      className={cn(
        'inline-block rounded-full px-1.5 py-0.5 text-[0.5625rem] font-semibold',
        tokens[status].className,
      )}
    >
      {tokens[status].label}
    </span>
  );
}
