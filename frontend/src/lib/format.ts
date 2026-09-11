/**
 * Presentation formatting.
 *
 * All of it locale-aware through `Intl`, and all of it tolerant of the nulls a
 * REST payload can legitimately contain — a formatter that throws on a missing
 * optional field turns one absent value into a blank screen.
 */

const DEFAULT_LOCALE = 'en-US';

/** Whole-unit quantity, e.g. `1,240`. */
export function formatQuantity(value: number | string | null | undefined): string {
  const amount = toNumber(value);
  if (amount === null) return '—';

  return new Intl.NumberFormat(DEFAULT_LOCALE, { maximumFractionDigits: 0 }).format(amount);
}

/** Quantity with its unit abbreviation, e.g. `1,240 ea`. */
export function formatQuantityWithUnit(
  value: number | string | null | undefined,
  unit?: string | null,
): string {
  const quantity = formatQuantity(value);
  return unit ? `${quantity} ${unit}` : quantity;
}

/** Compact form for KPI tiles where space is tight, e.g. `12.4K`. */
export function formatCompact(value: number | string | null | undefined): string {
  const amount = toNumber(value);
  if (amount === null) return '—';

  if (Math.abs(amount) < 10_000) {
    return new Intl.NumberFormat(DEFAULT_LOCALE, { maximumFractionDigits: 0 }).format(amount);
  }

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * Currency. Used only for reference prices and captured unit costs — never for
 * inventory valuation, which this product deliberately does not compute.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency = 'USD',
): string {
  const amount = toNumber(value);
  if (amount === null) return '—';

  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown currency code should not blank the cell.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Signed quantity with an explicit sign, e.g. `+40` / `−12`. Uses a true minus. */
export function formatSigned(value: number | string | null | undefined): string {
  const amount = toNumber(value);
  if (amount === null) return '—';

  const magnitude = new Intl.NumberFormat(DEFAULT_LOCALE, { maximumFractionDigits: 0 }).format(
    Math.abs(amount),
  );

  if (amount === 0) return magnitude;

  return amount > 0 ? `+${magnitude}` : `−${magnitude}`;
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'percent',
    maximumFractionDigits: fractionDigits,
    signDisplay: 'exceptZero',
  }).format(value / 100);
}

/** `14 Mar 2026` */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** `14 Mar 2026, 09:15` */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** `09:15` */
export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * `3 days ago`, `in 2 weeks`. Used in activity feeds and notification lists,
 * where "when, roughly" is more useful than an exact timestamp.
 */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';

  const formatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' });
  const elapsedSeconds = (date.getTime() - Date.now()) / 1000;

  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.345],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ];

  let duration = elapsedSeconds;

  for (const [unit, amount] of thresholds) {
    if (Math.abs(duration) < amount) {
      return formatter.format(Math.round(duration), unit);
    }
    duration /= amount;
  }

  return formatDate(date);
}

/** `FS-DRL-1801` → initials for an avatar-style placeholder. */
export function initialsOf(value: string | null | undefined): string {
  if (!value) return '?';

  const parts = value.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';

  return (first + last).toUpperCase() || '?';
}

/** Truncate for a fixed-width cell, preserving whole words where possible. */
export function truncate(value: string | null | undefined, max = 60): string {
  if (!value) return '';
  if (value.length <= max) return value;

  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** ISO date string for `<input type="date">`. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  const amount = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(amount) ? amount : null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
