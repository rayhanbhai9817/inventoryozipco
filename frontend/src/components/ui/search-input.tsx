'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Debounced search field.
 *
 * Keeps its own value so typing stays responsive, and reports upward only after
 * the user pauses — so a five-character query is one request, not five. Escape
 * clears, which is what people expect from a search box.
 */
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Debounce in ms. 300 is long enough to batch typing, short enough to feel live. */
  delay?: number;
  /** Shows a spinner in place of the clear button while a request is in flight. */
  loading?: boolean;
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  delay = 300,
  loading = false,
  autoFocus = false,
  className,
  'aria-label': ariaLabel = 'Search',
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks the value we last reported, so an external reset does not bounce back.
  const reported = useRef(value);

  // Adopt an externally cleared or changed value (e.g. "clear all filters").
  useEffect(() => {
    if (value !== reported.current) {
      reported.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft === reported.current) return;

    const timer = setTimeout(() => {
      reported.current = draft;
      onChange(draft);
    }, delay);

    return () => clearTimeout(timer);
  }, [draft, delay, onChange]);

  function clear() {
    setDraft('');
    reported.current = '';
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <Icon
        name="search"
        size={17}
        className="pointer-events-none absolute left-3 text-content-tertiary"
      />
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={draft}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && draft) {
            event.preventDefault();
            clear();
          }
        }}
        className="h-10 w-full rounded-lg bg-surface-card pr-9 pl-10 text-sm text-content-primary ring-1 ring-border-default ring-inset transition-shadow placeholder:text-content-tertiary focus:ring-2 focus:ring-brand-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {loading ? (
        <Spinner size={15} className="absolute right-3 text-brand-500" />
      ) : draft ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-secondary dark:hover:bg-surface-raised"
        >
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}
