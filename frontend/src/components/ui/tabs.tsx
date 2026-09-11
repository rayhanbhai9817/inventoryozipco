'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { CountBubble } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Tabs

   Two flavours, both underline-style:
   - `Tabs` for in-page state (a detail page's sections).
   - `TabLinks` for real navigation, where each tab is a URL.

   Horizontally scrollable on narrow screens rather than wrapping into a
   multi-row block, which keeps the underline legible.
   ========================================================================== */

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  icon?: IconName;
  count?: number;
}

export interface TabsProps<T extends string> {
  tabs: Array<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  'aria-label': ariaLabel = 'Sections',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        '-mb-px flex gap-1 overflow-x-auto border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
              active
                ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-content-secondary hover:border-border-default hover:text-content-primary',
            )}
          >
            {tab.icon ? <Icon name={tab.icon} size={16} /> : null}
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <CountBubble count={tab.count} tone={active ? 'brand' : 'neutral'} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export interface TabLink {
  href: string;
  label: string;
  icon?: IconName;
  count?: number;
}

export function TabLinks({
  tabs,
  currentPath,
  className,
  'aria-label': ariaLabel = 'Sections',
}: {
  tabs: TabLink[];
  currentPath: string;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        '-mb-px flex gap-1 overflow-x-auto border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = currentPath === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
              active
                ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-content-secondary hover:border-border-default hover:text-content-primary',
            )}
          >
            {tab.icon ? <Icon name={tab.icon} size={16} /> : null}
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <CountBubble count={tab.count} tone={active ? 'brand' : 'neutral'} />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabPanel({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;

  return (
    <div role="tabpanel" className={cn('animate-fade-in', className)}>
      {children}
    </div>
  );
}

/* ==========================================================================
   Segmented control — for short, mutually exclusive choices like a date range
   ========================================================================== */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5 ring-1 ring-border-subtle ring-inset',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md font-medium whitespace-nowrap transition-all duration-150',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[0.8125rem]',
              active
                ? 'bg-surface-card text-content-primary shadow-xs'
                : 'text-content-secondary hover:text-content-primary',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
