'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api-client';

/**
 * The data-fetching hook every screen uses.
 *
 * Deliberately small — no caching layer, no query client. The dashboard's screens
 * each load one or two endpoints on mount and refetch on an explicit action, which
 * this covers in thirty lines. Adding a cache would be weight without a problem to
 * solve yet, and would make the Laravel-backed and demo paths behave differently.
 *
 * Handles the two things a hand-rolled `useEffect` fetch usually gets wrong:
 * it ignores responses from superseded requests (so fast filter typing cannot
 * render stale results), and it does not set state after unmount.
 */

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  /** A message already safe to show a user. */
  error: string | null;
  /** The original error, for callers that need the status or field errors. */
  apiError: ApiError | null;
  /** Re-run the loader. */
  reload: () => void;
  /** Replace the data locally, for optimistic updates. */
  setData: (updater: T | ((current: T | null) => T | null)) => void;
}

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
  options: { enabled?: boolean } = {},
): AsyncState<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Increments per request; only the newest result is allowed to win.
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The loader closes over the caller's dependencies, which are the real inputs.
  const run = useCallback(loader, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const id = ++requestId.current;

    setLoading(true);
    setError(null);
    setApiError(null);

    run()
      .then((result) => {
        if (!mounted.current || id !== requestId.current) return;

        setData(result);
      })
      .catch((caught: unknown) => {
        if (!mounted.current || id !== requestId.current) return;

        if (caught instanceof ApiError) {
          setApiError(caught);
          setError(caught.message);
        } else {
          setError('Something went wrong. Please try again.');
        }
      })
      .finally(() => {
        if (!mounted.current || id !== requestId.current) return;

        setLoading(false);
      });
  }, [run, enabled, reloadToken]);

  const update = useCallback((updater: T | ((current: T | null) => T | null)) => {
    setData((current) =>
      typeof updater === 'function' ? (updater as (value: T | null) => T | null)(current) : updater,
    );
  }, []);

  return {
    data,
    loading,
    error,
    apiError,
    reload: useCallback(() => setReloadToken((token) => token + 1), []),
    setData: update,
  };
}

/**
 * Wraps a mutating action with submitting state and friendly error handling, so
 * every form in the product reports progress and failure the same way.
 */
export function useSubmit<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setSubmitting(true);
      setError(null);
      setFieldErrors({});

      try {
        return await action(...args);
      } catch (caught) {
        if (caught instanceof ApiError) {
          setError(caught.message);

          // Flatten Laravel's `{field: [messages]}` to the first message per
          // field, which is what an inline error slot can show.
          setFieldErrors(
            Object.fromEntries(
              Object.entries(caught.fieldErrors).map(([field, messages]) => [field, messages[0]]),
            ),
          );
        } else {
          setError('Something went wrong. Please try again.');
        }

        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [action],
  );

  return {
    submit,
    submitting,
    error,
    fieldErrors,
    reset: useCallback(() => {
      setError(null);
      setFieldErrors({});
    }, []),
  };
}
