import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * A composed preview of the real dashboard, built from the same design tokens
 * as the product itself.
 *
 * Deliberately hand-built rather than a screenshot or a stock photo: it stays
 * crisp at any size, adapts to light and dark, costs no image bytes, and — because
 * it uses the same colours, radii and type as the app — it promises exactly what
 * the product delivers. It is decorative, so it is hidden from assistive tech;
 * the surrounding copy carries the meaning.
 */
export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-surface-card shadow-2xl ring-1 ring-border-subtle',
        className,
      )}
      aria-hidden
    >
      {/* Browser chrome — just enough to read as "an application". */}
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-sunken/70 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300 dark:bg-ink-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300 dark:bg-ink-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300 dark:bg-ink-700" />
        </div>
        <div className="mx-auto flex max-w-[16rem] flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-card px-3 py-1 text-[0.625rem] text-content-tertiary ring-1 ring-border-subtle">
          <Icon name="lock" size={9} />
          app.fastsold.com/dashboard
        </div>
      </div>

      <div className="flex">
        {/* ---------- Sidebar ---------- */}
        <div className="hidden w-44 shrink-0 border-r border-border-subtle bg-surface-sunken/40 p-3 sm:block">
          <div className="mb-4 flex items-center gap-2 px-1">
            <span className="h-6 w-6 rounded-lg bg-gradient-to-br from-brand-500 via-brand-600 to-ember-500" />
            <span className="text-[0.6875rem] font-semibold text-content-primary">Fast Sold</span>
          </div>

          <PreviewNavGroup
            items={[
              { label: 'Dashboard', icon: 'gauge', active: true },
              { label: 'Products', icon: 'package' },
              { label: 'Inventory', icon: 'boxes', badge: '3' },
            ]}
          />
          <p className="mt-4 mb-1.5 px-1 text-[0.5625rem] font-semibold tracking-wider text-content-tertiary uppercase">
            Movements
          </p>
          <PreviewNavGroup
            items={[
              { label: 'Stock in', icon: 'arrow-down-right' },
              { label: 'Stock out', icon: 'arrow-up-right' },
              { label: 'Suppliers', icon: 'truck' },
            ]}
          />
          <p className="mt-4 mb-1.5 px-1 text-[0.5625rem] font-semibold tracking-wider text-content-tertiary uppercase">
            Insight
          </p>
          <PreviewNavGroup
            items={[
              { label: 'Reports', icon: 'activity' },
              { label: 'Audit log', icon: 'history' },
            ]}
          />
        </div>

        {/* ---------- Main ---------- */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold text-content-primary">
                Good morning, Dana
              </p>
              <p className="mt-0.5 text-[0.625rem] text-content-tertiary">
                3 products need attention · Last 30 days
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-sunken px-2 text-[0.625rem] font-medium text-content-secondary ring-1 ring-border-subtle">
                <Icon name="calendar" size={9} />
                30 days
              </span>
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-600 px-2 text-[0.625rem] font-semibold text-white">
                <Icon name="plus" size={9} />
                New
              </span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <PreviewKpi label="Total products" value="22" icon="package" tone="brand" />
            <PreviewKpi label="Units on hand" value="1,486" icon="boxes" tone="neutral" />
            <PreviewKpi label="Low stock" value="3" icon="alert-triangle" tone="caution" />
            <PreviewKpi label="Out of stock" value="3" icon="alert-circle" tone="critical" />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            {/* Trend chart */}
            <div className="rounded-xl bg-surface-card p-3 ring-1 ring-border-subtle lg:col-span-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[0.6875rem] font-semibold text-content-primary">
                  Stock movement
                </p>
                <div className="flex gap-2.5">
                  <LegendDot colour="var(--color-brand-500)" label="In" />
                  <LegendDot colour="var(--color-ember-500)" label="Out" />
                </div>
              </div>
              <PreviewChart />
            </div>

            {/* Needs attention */}
            <div className="rounded-xl bg-surface-card p-3 ring-1 ring-border-subtle lg:col-span-2">
              <p className="mb-2 text-[0.6875rem] font-semibold text-content-primary">
                Needs attention
              </p>
              <div className="space-y-2">
                <PreviewAlertRow name="125mm Angle Grinder" detail="0 of 5 minimum" tone="critical" />
                <PreviewAlertRow name="Hi-Vis Vest, Class 2" detail="0 of 25 minimum" tone="critical" />
                <PreviewAlertRow name="18V Impact Driver" detail="3 of 6 minimum" tone="caution" />
                <PreviewAlertRow name="Hard Hat, Vented" detail="7 of 12 minimum" tone="caution" />
              </div>
            </div>
          </div>

          {/* Recent movements table */}
          <div className="mt-3 overflow-hidden rounded-xl bg-surface-card ring-1 ring-border-subtle">
            <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
              <p className="text-[0.6875rem] font-semibold text-content-primary">
                Recent movements
              </p>
              <span className="text-[0.625rem] text-brand-600 dark:text-brand-300">View ledger</span>
            </div>
            <table className="w-full text-[0.625rem]">
              <thead>
                <tr className="bg-surface-sunken/50 text-content-tertiary">
                  <th className="px-3 py-1.5 text-left font-semibold">Product</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Type</th>
                  <th className="hidden px-3 py-1.5 text-left font-semibold sm:table-cell">Batch</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Qty</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <PreviewRow
                  product="Safety Goggles"
                  sku="FS-GOG-CLR"
                  type="out"
                  batch="IN-FSGOG-0031"
                  qty="−18"
                  balance="126"
                />
                <PreviewRow
                  product="2-Core Cable 100m"
                  sku="FS-CBL-2C15"
                  type="in"
                  batch="IN-FSCBL2-0037"
                  qty="+45"
                  balance="97"
                />
                <PreviewRow
                  product="M8 Hex Bolt"
                  sku="FS-BLT-M8"
                  type="out"
                  batch="IN-FSBLTM-0013"
                  qty="−22"
                  balance="68"
                />
                <PreviewRow
                  product="125mm Angle Grinder"
                  sku="FS-GRD-125"
                  type="adjustment"
                  batch="—"
                  qty="−2"
                  balance="0"
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PreviewNavGroup({
  items,
}: {
  items: Array<{ label: string; icon: Parameters<typeof Icon>[0]['name']; active?: boolean; badge?: string }>;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.625rem] font-medium',
            item.active
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200'
              : 'text-content-secondary',
          )}
        >
          <Icon name={item.icon} size={11} />
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-caution-500 px-1 text-[0.5rem] font-bold text-white">
              {item.badge}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PreviewKpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: Parameters<typeof Icon>[0]['name'];
  tone: 'brand' | 'neutral' | 'caution' | 'critical';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300',
    neutral: 'bg-ink-100 text-ink-600 dark:bg-surface-raised dark:text-ink-300',
    caution: 'bg-caution-50 text-caution-600 dark:bg-caution-700/20 dark:text-caution-200',
    critical: 'bg-critical-50 text-critical-600 dark:bg-critical-700/20 dark:text-critical-200',
  };

  return (
    <div className="rounded-xl bg-surface-card p-2.5 ring-1 ring-border-subtle">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.625rem] leading-tight font-medium text-content-secondary">
          {label}
        </span>
        <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md', tones[tone])}>
          <Icon name={icon} size={10} />
        </span>
      </div>
      <p className="mt-1 font-display text-base leading-none font-semibold tabular-nums text-content-primary">
        {value}
      </p>
    </div>
  );
}

function LegendDot({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.5625rem] text-content-tertiary">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colour }} />
      {label}
    </span>
  );
}

/** A fixed, plausible-looking trend. Same drawing approach as the real chart. */
function PreviewChart() {
  const inSeries = [18, 26, 22, 38, 30, 44, 36, 52, 46, 58, 50, 64];
  const outSeries = [12, 20, 30, 24, 34, 28, 42, 34, 48, 40, 54, 46];

  const width = 300;
  const height = 76;
  const max = Math.max(...inSeries, ...outSeries);
  const step = width / (inSeries.length - 1);

  const toPath = (series: number[]) =>
    series
      .map((value, index) => {
        const x = index * step;
        const y = height - 4 - (value / max) * (height - 10);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const inPath = toPath(inSeries);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="preview-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1="0"
          x2={width}
          y1={height - 4 - ratio * (height - 10)}
          y2={height - 4 - ratio * (height - 10)}
          stroke="var(--border-subtle)"
          strokeDasharray="2 4"
        />
      ))}
      <path d={`${inPath} L${width},${height} L0,${height} Z`} fill="url(#preview-area)" />
      <path d={inPath} fill="none" stroke="var(--color-brand-500)" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d={toPath(outSeries)}
        fill="none"
        stroke="var(--color-ember-500)"
        strokeWidth="1.75"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PreviewAlertRow({
  name,
  detail,
  tone,
}: {
  name: string;
  detail: string;
  tone: 'critical' | 'caution';
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          tone === 'critical' ? 'bg-critical-500' : 'bg-caution-500',
        )}
      />
      <span className="min-w-0 flex-1 truncate text-[0.625rem] font-medium text-content-primary">
        {name}
      </span>
      <span className="shrink-0 text-[0.5625rem] tabular-nums text-content-tertiary">{detail}</span>
    </div>
  );
}

function PreviewRow({
  product,
  sku,
  type,
  batch,
  qty,
  balance,
}: {
  product: string;
  sku: string;
  type: 'in' | 'out' | 'adjustment';
  batch: string;
  qty: string;
  balance: string;
}) {
  const badges = {
    in: { label: 'Stock in', className: 'bg-positive-50 text-positive-700 dark:bg-positive-700/20 dark:text-positive-200' },
    out: { label: 'Stock out', className: 'bg-info-50 text-info-700 dark:bg-info-700/20 dark:text-info-200' },
    adjustment: {
      label: 'Adjust',
      className: 'bg-caution-50 text-caution-700 dark:bg-caution-700/20 dark:text-caution-200',
    },
  };

  return (
    <tr className="border-t border-border-subtle/70">
      <td className="px-3 py-1.5">
        <span className="block truncate font-medium text-content-primary">{product}</span>
        <span className="block font-mono text-[0.5625rem] text-content-tertiary">{sku}</span>
      </td>
      <td className="px-3 py-1.5">
        <span
          className={cn(
            'inline-block rounded-full px-1.5 py-0.5 text-[0.5625rem] font-semibold',
            badges[type].className,
          )}
        >
          {badges[type].label}
        </span>
      </td>
      <td className="hidden px-3 py-1.5 font-mono text-[0.5625rem] text-content-tertiary sm:table-cell">
        {batch}
      </td>
      <td
        className={cn(
          'px-3 py-1.5 text-right font-semibold',
          qty.startsWith('+') ? 'text-positive-600 dark:text-positive-300' : 'text-content-primary',
        )}
      >
        {qty}
      </td>
      <td className="px-3 py-1.5 text-right text-content-secondary">{balance}</td>
    </tr>
  );
}
