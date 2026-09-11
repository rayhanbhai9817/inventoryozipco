'use client';

import { useId, useState } from 'react';

import { formatCompact, formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Charts

   Hand-built inline SVG rather than a charting library. Three reasons:
   the dashboard needs exactly three chart types; inline SVG inherits the design
   tokens directly so the charts match the rest of the product; and it keeps the
   client bundle small on the page users open most often.

   Accessibility: every chart is also a table. The visual is `aria-hidden` and a
   screen-reader-only `<table>` carries the same numbers, so the data is never
   only available as a picture.
   ========================================================================== */

const SERIES_COLOURS = {
  in: 'var(--color-brand-500)',
  out: 'var(--color-ember-500)',
} as const;

/* -------------------------------------------------------------------------- */
/* Stock in vs stock out, over time                                           */
/* -------------------------------------------------------------------------- */

export interface TrendPoint {
  date: string;
  stock_in: number;
  stock_out: number;
}

export function MovementTrendChart({
  data,
  height = 220,
  className,
}: {
  data: TrendPoint[];
  height?: number;
  className?: string;
}) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-[0.8125rem] text-content-tertiary',
          className,
        )}
        style={{ height }}
      >
        Not enough movement yet to draw a trend.
      </div>
    );
  }

  const width = 720;
  const padding = { top: 12, right: 8, bottom: 26, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const peak = Math.max(1, ...data.flatMap((point) => [point.stock_in, point.stock_out]));
  // Round the axis up to something readable rather than to the raw maximum.
  const axisMax = niceCeiling(peak);
  const step = plotWidth / (data.length - 1);

  const xOf = (index: number) => padding.left + index * step;
  const yOf = (value: number) => padding.top + plotHeight - (value / axisMax) * plotHeight;

  const linePath = (key: 'stock_in' | 'stock_out') =>
    data.map((point, index) => `${index === 0 ? 'M' : 'L'}${xOf(index)},${yOf(point[key])}`).join(' ');

  const areaPath = `${linePath('stock_in')} L${xOf(data.length - 1)},${padding.top + plotHeight} L${padding.left},${padding.top + plotHeight} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  // Show at most six date labels, however many points there are.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const active = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className={cn('relative', className)}>
      <div className="mb-3 flex items-center gap-4">
        <Legend colour={SERIES_COLOURS.in} label="Stock in" />
        <Legend colour={SERIES_COLOURS.out} label="Stock out" />
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        aria-hidden
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const relative = ((event.clientX - bounds.left) / bounds.width) * width;
          const index = Math.round((relative - padding.left) / step);
          setHoverIndex(index >= 0 && index < data.length ? index : null);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLOURS.in} stopOpacity="0.18" />
            <stop offset="100%" stopColor={SERIES_COLOURS.in} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((ratio) => {
          const y = padding.top + plotHeight - ratio * plotHeight;

          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--border-subtle)"
                strokeWidth="1"
                strokeDasharray={ratio === 0 ? undefined : '3 4'}
              />
              <text
                x={padding.left - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-[var(--text-tertiary)] text-[10px]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCompact(Math.round(ratio * axisMax))}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath('stock_in')}
          fill="none"
          stroke={SERIES_COLOURS.in}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={linePath('stock_out')}
          fill="none"
          stroke={SERIES_COLOURS.out}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />

        {data.map((point, index) =>
          index % labelEvery === 0 || index === data.length - 1 ? (
            <text
              key={point.date}
              x={xOf(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              className="fill-[var(--text-tertiary)] text-[10px]"
            >
              {shortDate(point.date)}
            </text>
          ) : null,
        )}

        {hoverIndex !== null && active ? (
          <g>
            <line
              x1={xOf(hoverIndex)}
              x2={xOf(hoverIndex)}
              y1={padding.top}
              y2={padding.top + plotHeight}
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
            <circle cx={xOf(hoverIndex)} cy={yOf(active.stock_in)} r="3.5" fill={SERIES_COLOURS.in} />
            <circle cx={xOf(hoverIndex)} cy={yOf(active.stock_out)} r="3.5" fill={SERIES_COLOURS.out} />
          </g>
        ) : null}
      </svg>

      {active ? (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg bg-surface-inverse px-2.5 py-2 text-xs text-content-inverse shadow-lg">
          <p className="font-medium">{formatDate(active.date)}</p>
          <p className="mt-1 flex items-center gap-1.5 opacity-90" data-numeric>
            <Dot colour={SERIES_COLOURS.in} /> In {formatQuantity(active.stock_in)}
          </p>
          <p className="flex items-center gap-1.5 opacity-90" data-numeric>
            <Dot colour={SERIES_COLOURS.out} /> Out {formatQuantity(active.stock_out)}
          </p>
        </div>
      ) : null}

      <ChartTable
        caption="Daily stock in and stock out"
        columns={['Date', 'Stock in', 'Stock out']}
        rows={data.map((point) => [
          formatDate(point.date),
          formatQuantity(point.stock_in),
          formatQuantity(point.stock_out),
        ])}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Horizontal bars — inventory by category, top movers                        */
/* -------------------------------------------------------------------------- */

export interface BarRow {
  label: string;
  value: number;
  /** Optional per-row colour; falls back to the brand ramp. */
  color?: string | null;
  /** Secondary text on the right, e.g. "12 products". */
  caption?: string;
}

export function HorizontalBarChart({
  rows,
  valueLabel = 'units',
  className,
  emptyMessage = 'Nothing to show yet.',
}: {
  rows: BarRow[];
  valueLabel?: string;
  className?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className={cn('py-8 text-center text-[0.8125rem] text-content-tertiary', className)}>
        {emptyMessage}
      </p>
    );
  }

  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className={cn('space-y-3', className)}>
      <ul className="space-y-3" aria-hidden>
        {rows.map((row, index) => {
          const percentage = (row.value / max) * 100;
          const colour = row.color ?? fallbackColour(index);

          return (
            <li key={`${row.label}-${index}`} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span className="truncate font-medium text-content-primary">{row.label}</span>
                <span className="shrink-0 tabular-nums text-content-secondary" data-numeric>
                  {formatQuantity(row.value)}
                  {row.caption ? (
                    <span className="ml-2 text-xs text-content-tertiary">{row.caption}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(percentage, 1.5)}%`,
                    backgroundColor: colour,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <ChartTable
        caption={`Breakdown by ${valueLabel}`}
        columns={['Name', 'Value']}
        rows={rows.map((row) => [row.label, formatQuantity(row.value)])}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Donut — stock health at a glance                                           */
/* -------------------------------------------------------------------------- */

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 168,
  className,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row sm:gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-sunken)"
            strokeWidth="16"
          />
          {total > 0
            ? segments.map((segment) => {
                const length = (segment.value / total) * circumference;
                const dash = `${length} ${circumference - length}`;
                const element = (
                  <circle
                    key={segment.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="16"
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                    // Start at 12 o'clock rather than 3, which reads more naturally.
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  />
                );
                offset += length;
                return element;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className="font-display text-xl leading-none font-semibold text-content-primary"
            data-numeric
          >
            {centerValue ?? formatCompact(total)}
          </span>
          {centerLabel ? (
            <span className="mt-1 text-[0.6875rem] tracking-wide text-content-tertiary uppercase">
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="w-full space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-[0.8125rem]">
            <span className="flex min-w-0 items-center gap-2">
              <Dot colour={segment.color} />
              <span className="truncate text-content-secondary">{segment.label}</span>
            </span>
            <span className="shrink-0 font-medium text-content-primary" data-numeric>
              {formatQuantity(segment.value)}
              {total > 0 ? (
                <span className="ml-1.5 text-xs text-content-tertiary">
                  {Math.round((segment.value / total) * 100)}%
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-content-secondary">
      <Dot colour={colour} />
      {label}
    </span>
  );
}

function Dot({ colour }: { colour: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colour }}
      aria-hidden
    />
  );
}

/**
 * The screen-reader equivalent of a chart. Visually hidden, semantically a real
 * table — so the numbers behind every visual are always available.
 */
function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Round an axis maximum up to a readable 1 / 2 / 5 × 10ⁿ value. */
function niceCeiling(value: number): number {
  if (value <= 5) return 5;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

  return nice * magnitude;
}

function shortDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(date);
}

/** Category colours when a business has not chosen one. */
function fallbackColour(index: number): string {
  const palette = [
    'var(--color-brand-500)',
    'var(--color-ember-500)',
    'var(--color-info-500)',
    'var(--color-brand-700)',
    'var(--color-caution-500)',
    'var(--color-brand-300)',
  ];

  return palette[index % palette.length];
}
