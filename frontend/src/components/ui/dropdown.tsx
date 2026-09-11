'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Dropdown menu

   Anchored popover with keyboard support: Arrow keys move, Enter activates,
   Escape closes and returns focus to the trigger, Tab closes. Closes on outside
   click and on scroll of an ancestor, so it never floats detached from its
   trigger.
   ========================================================================== */

export interface DropdownItem {
  label: string;
  icon?: IconName;
  onClick?: () => void;
  href?: string;
  /** Red styling for destructive entries. */
  destructive?: boolean;
  disabled?: boolean;
  /** Right-aligned hint, e.g. a shortcut or a count. */
  hint?: string;
}

export interface DropdownProps {
  /** The trigger. Receives nothing — wrap your own button. */
  trigger: ReactNode;
  items: Array<DropdownItem | 'separator'>;
  align?: 'start' | 'end';
  /** Optional heading at the top of the menu. */
  label?: string;
  className?: string;
  menuClassName?: string;
}

export function Dropdown({
  trigger,
  items,
  align = 'end',
  label,
  className,
  menuClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const actionable = items.filter((item): item is DropdownItem => item !== 'separator' && !item.disabled);

  function close(returnFocus = true) {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    }

    // A menu that stays put while the page scrolls looks broken, so close it.
    function handleScroll() {
      close(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % actionable.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + actionable.length) % actionable.length);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(actionable.length - 1);
        break;
      case 'Tab':
        close(false);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const item = actionable[activeIndex];
        if (item) {
          item.onClick?.();
          close();
        }
        break;
      }
      default:
        break;
    }
  }

  let actionableIndex = -1;

  return (
    <div ref={containerRef} className={cn('relative', className)} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="block"
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 mt-1.5 min-w-56 animate-scale-in overflow-hidden rounded-xl bg-surface-card p-1 shadow-lg ring-1 ring-border-subtle',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            menuClassName,
          )}
        >
          {label ? (
            <p className="px-2.5 pt-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wide text-content-tertiary uppercase">
              {label}
            </p>
          ) : null}

          {items.map((item, index) => {
            if (item === 'separator') {
              return (
                <div
                  key={`separator-${index}`}
                  role="separator"
                  className="my-1 h-px bg-border-subtle"
                />
              );
            }

            if (!item.disabled) actionableIndex += 1;
            const isActive = !item.disabled && actionableIndex === activeIndex;

            const classes = cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-medium transition-colors',
              item.disabled
                ? 'cursor-not-allowed text-content-tertiary opacity-60'
                : item.destructive
                  ? 'text-critical-600 hover:bg-critical-50 dark:text-critical-300 dark:hover:bg-critical-700/15'
                  : 'text-content-primary hover:bg-ink-100 dark:hover:bg-surface-raised',
              isActive && !item.destructive && 'bg-ink-100 dark:bg-surface-raised',
              isActive && item.destructive && 'bg-critical-50 dark:bg-critical-700/15',
            );

            const content = (
              <>
                {item.icon ? <Icon name={item.icon} size={16} className="shrink-0" /> : null}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint ? (
                  <span className="shrink-0 text-xs text-content-tertiary">{item.hint}</span>
                ) : null}
              </>
            );

            if (item.href && !item.disabled) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  className={classes}
                  onClick={() => close(false)}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={classes}
                onClick={() => {
                  item.onClick?.();
                  close(false);
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Row actions — the "…" menu at the end of a table row
   ========================================================================== */

export function RowActions({ items }: { items: Array<DropdownItem | 'separator'> }) {
  return (
    <Dropdown
      align="end"
      items={items}
      trigger={
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
          aria-label="Row actions"
        >
          <Icon name="more-horizontal" size={17} />
        </span>
      }
    />
  );
}
