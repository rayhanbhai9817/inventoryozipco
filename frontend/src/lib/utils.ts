/**
 * Small, dependency-free helpers shared across the UI.
 */

/**
 * Conditional class names. Deliberately not `clsx` + `tailwind-merge`: the
 * component library uses explicit variant maps rather than overlapping utility
 * strings, so there is nothing to de-duplicate and nothing to install.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Clamp a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Stable unique id for pairing labels, inputs and their error messages.
 * Uses `crypto.randomUUID` where available so ids never collide on a page.
 */
export function uid(prefix = 'fs'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${prefix}-${random}`;
}

/**
 * Trap focus inside an element — used by the modal and the mobile drawer, both
 * of which must not let Tab escape to the page behind them.
 *
 * Returns a cleanup function.
 */
export function trapFocus(container: HTMLElement): () => void {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => element.offsetParent !== null,
    );

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  return () => container.removeEventListener('keydown', handleKeyDown);
}

/** Prevent the page behind a modal from scrolling, restoring the previous value. */
export function lockBodyScroll(): () => void {
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = previous;
  };
}

/**
 * Build a query string from a filter object, dropping empty values so the URL
 * stays readable and the backend receives only the filters actually set.
 */
export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      value.forEach((entry) => search.append(`${key}[]`, String(entry)));
      continue;
    }

    if (typeof value === 'boolean') {
      search.set(key, value ? '1' : '0');
      continue;
    }

    search.set(key, String(value));
  }

  return search.toString();
}

/** Group an array by a derived key, preserving insertion order. */
export function groupBy<T, K extends string>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Record<K, T[]> {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = keyOf(item);
    (groups[key] ??= []).push(item);
    return groups;
  }, {}) as Record<K, T[]>;
}
