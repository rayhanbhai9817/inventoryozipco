'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, DEMO_MODE, setUnauthenticatedHandler, tokenStore } from '@/lib/api-client';
import { auth as authApi, fetchUnreadCount } from '@/lib/data-source';
import type { LoginPayload, PermissionKey, RegisterPayload, User } from '@/types/api';

/**
 * Session state for the whole app.
 *
 * `can()` is how every screen decides what to render. It reads the permission
 * list the API returned for this user — which is the *same* list the backend
 * checks against, so there is one source of truth and no chance of the UI
 * offering an action the server will refuse.
 *
 * Hiding a control is a courtesy to the user, never the security boundary.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  unreadNotifications: number;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  can: (...permissions: PermissionKey[]) => boolean;
  canAll: (...permissions: PermissionKey[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setUnreadNotifications(0);
    setStatus('unauthenticated');
  }, []);

  /** Load (or reload) the signed-in user from `/auth/me`. */
  const refresh = useCallback(async () => {
    // Demo mode has no token to check; the session is always "available".
    if (!DEMO_MODE && !tokenStore.get()) {
      setStatus('unauthenticated');
      return;
    }

    try {
      const { user: currentUser, unread_notifications } = await authApi.me();
      setUser(currentUser);
      setUnreadNotifications(unread_notifications);
      setStatus('authenticated');
    } catch (error) {
      // A 401 means the token is gone or expired — the request layer has already
      // cleared it. Anything else is a transient failure, and signing the user
      // out over a flaky network would be worse than leaving them be.
      if (error instanceof ApiError && error.isUnauthenticated) {
        clearSession();
      } else {
        setStatus('unauthenticated');
      }
    }
  }, [clearSession]);

  // One place handles a 401 from anywhere in the app.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null);
      setUnreadNotifications(0);
      setStatus('unauthenticated');
      router.replace('/login?expired=1');
    });

    return () => setUnauthenticatedHandler(null);
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await authApi.login(payload);

      tokenStore.set(session.token);
      setUser(session.user);
      setStatus('authenticated');

      // Best-effort: a failed badge count should not block signing in.
      void fetchUnreadCount()
        .then(setUnreadNotifications)
        .catch(() => setUnreadNotifications(0));
    },
    [],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    const session = await authApi.register(payload);

    tokenStore.set(session.token);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Revoking server-side is best-effort; the local session goes either way.
    } finally {
      clearSession();
      router.replace('/login');
    }
  }, [clearSession, router]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      setUnreadNotifications(await fetchUnreadCount());
    } catch {
      /* leave the current count in place */
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const held = new Set(user?.permissions ?? []);

    return {
      status,
      user,
      unreadNotifications,
      login,
      register,
      logout,
      refresh,
      refreshUnreadCount,
      can: (...permissions) => permissions.some((permission) => held.has(permission)),
      canAll: (...permissions) => permissions.every((permission) => held.has(permission)),
    };
  }, [status, user, unreadNotifications, login, register, logout, refresh, refreshUnreadCount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }

  return context;
}

/**
 * The signed-in user, or a throw.
 *
 * For use inside the authenticated layout, which has already established that a
 * user exists — it saves every screen a null check.
 */
export function useCurrentUser(): User {
  const { user } = useAuth();

  if (!user) {
    throw new Error('useCurrentUser was called outside the authenticated area.');
  }

  return user;
}
