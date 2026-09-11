'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'subtle'
  | 'danger'
  | 'danger-subtle'
  | 'inverse';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  // The primary action. A subtle top highlight gives it a little physicality
  // without resorting to a heavy gradient.
  primary:
    'bg-brand-600 text-white shadow-xs ring-1 ring-brand-700/60 ring-inset hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 disabled:ring-transparent',
  secondary:
    'bg-surface-card text-content-primary ring-1 ring-border-default ring-inset shadow-xs hover:bg-ink-50 active:bg-ink-100 dark:hover:bg-surface-raised',
  ghost: 'text-content-secondary hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900',
  danger:
    'bg-critical-600 text-white shadow-xs ring-1 ring-critical-700/60 ring-inset hover:bg-critical-700 active:bg-critical-700 disabled:bg-critical-500/50',
  'danger-subtle':
    'bg-critical-50 text-critical-700 hover:bg-critical-100 dark:bg-critical-700/15 dark:text-critical-100 dark:hover:bg-critical-700/25',
  inverse:
    'bg-ink-900 text-white shadow-xs hover:bg-ink-800 active:bg-ink-950 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1.5 rounded-md px-2 text-xs',
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[0.8125rem]',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[0.9375rem]',
};

const ICON_SIZES: Record<ButtonSize, number> = { xs: 14, sm: 16, md: 18, lg: 19 };

const BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-60 disabled:active:translate-y-0';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label. */
  icon?: IconName;
  /** Icon after the label — use for "next", "external", disclosure. */
  trailingIcon?: IconName;
  /** Swaps the leading icon for a spinner and blocks interaction. */
  loading?: boolean;
  /** Square button with no label. `aria-label` becomes required. */
  iconOnly?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
  className?: string;
}

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {}

function classesFor({
  variant = 'primary',
  size = 'md',
  iconOnly,
  fullWidth,
  className,
}: CommonProps): string {
  return cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    iconOnly && ICON_ONLY_SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  xs: 'w-7 px-0',
  sm: 'w-9 px-0',
  md: 'w-10 px-0',
  lg: 'w-12 px-0',
};

function Content({
  icon,
  trailingIcon,
  loading,
  size = 'md',
  children,
}: Pick<CommonProps, 'icon' | 'trailingIcon' | 'loading' | 'size' | 'children'>) {
  const iconSize = ICON_SIZES[size];

  return (
    <>
      {loading ? (
        <Spinner size={iconSize} />
      ) : icon ? (
        <Icon name={icon} size={iconSize} />
      ) : null}
      {children}
      {trailingIcon && !loading ? <Icon name={trailingIcon} size={iconSize} /> : null}
    </>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  loading = false,
  iconOnly = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      // Announces the pending state rather than leaving a screen reader with a
      // button that silently stops responding.
      aria-busy={loading || undefined}
      className={classesFor({ variant, size, iconOnly, fullWidth, className })}
      {...props}
    >
      <Content icon={icon} trailingIcon={trailingIcon} loading={loading} size={size}>
        {children}
      </Content>
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps {
  href: string;
  external?: boolean;
  'aria-label'?: string;
  onClick?: () => void;
}

/** A link styled as a button. Keeps navigation semantics instead of faking them. */
export function ButtonLink({
  href,
  external = false,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  iconOnly = false,
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const classes = classesFor({ variant, size, iconOnly, fullWidth, className });
  const content = (
    <Content icon={icon} trailingIcon={trailingIcon} size={size}>
      {children}
    </Content>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} {...props}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {content}
    </Link>
  );
}

/** The one spinner used everywhere something is pending. */
export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('animate-spin', className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" fill="none" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
