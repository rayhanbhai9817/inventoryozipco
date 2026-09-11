'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Theme handling.
 *
 * Light is the primary theme. Dark mode exists because a warehouse screen is
 * often in a dim room, and because the token architecture made it nearly free —
 * `globals.css` redefines a handful of semantic variables under `.dark` rather
 * than every component carrying `dark:` variants.
 *
 * `system` is the default, so the product respects the OS until the user says
 * otherwise. The applied class is set by an inline script in the document head
 * (see `ThemeScript`) to avoid a flash of the wrong theme before hydration.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'fastsold.theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');

  // Read the stored preference once on mount. The inline script has already
  // applied the class, so this only syncs React's copy of the state.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    } catch {
      /* storage unavailable — stay on system */
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    const sync = () => setSystemTheme(query.matches ? 'dark' : 'light');
    sync();

    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference,
      toggle: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
    }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside a <ThemeProvider>.');
  }

  return context;
}

/**
 * Applies the theme class before first paint.
 *
 * Without this, a user on dark mode sees a white flash on every hard navigation.
 * The script is tiny, synchronous, and wrapped in try/catch because blocked
 * storage must not break rendering.
 */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var dark = stored === 'dark' ||
      ((stored === 'system' || !stored) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (error) {}
})();`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
