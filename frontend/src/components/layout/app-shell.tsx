'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { BrandLogo, Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth';
import { visibleNavigation } from '@/lib/navigation';
import { cn, lockBodyScroll, trapFocus } from '@/lib/utils';

const SIDEBAR_STORAGE_KEY = 'fastsold.sidebar-collapsed';

/**
 * The authenticated application shell.
 *
 * Also the route guard: an unauthenticated visitor is redirected to sign in with
 * the page they wanted preserved in `?next=`, so they land where they meant to
 * after authenticating.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, unreadNotifications, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Restore the collapsed preference. Read after mount so the server and client
  // agree on the first render.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
    } catch {
      /* storage unavailable */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }

      return next;
    });
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      const next = pathname && pathname !== '/dashboard' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [status, router, pathname]);

  // Close the drawer on navigation — otherwise it stays open over the new page.
  useEffect(() => setMobileNavOpen(false), [pathname]);

  if (status === 'loading' || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-page">
        <div className="text-center">
          <BrandLogo size={36} className="mx-auto" />
          <LoadingState label="Loading your workspace…" className="mt-4" />
        </div>
      </div>
    );
  }

  const sections = visibleNavigation(user.permissions);

  return (
    <div className="min-h-dvh bg-surface-page">
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <Sidebar
          sections={sections}
          badges={{ notifications: unreadNotifications }}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          businessName={user.business?.name}
        />
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        sections={sections}
        unreadNotifications={unreadNotifications}
        businessName={user.business?.name}
      />

      {/* ---------- Main column ---------- */}
      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
        <Topbar
          user={user}
          unreadNotifications={unreadNotifications}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onSignOut={() => void logout()}
        />

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-[90rem]">{children}</div>
        </main>

        <footer className="border-t border-border-subtle px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-2 text-xs text-content-tertiary">
            <p>© {new Date().getFullYear()} Fast Sold LLC</p>
            <p className="inline-flex items-center gap-1.5">
              <Icon name="lock" size={12} />
              {user.business?.name ?? 'Your business'} · data isolated from other businesses
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile navigation drawer                                                   */
/* -------------------------------------------------------------------------- */

function MobileNav({
  open,
  onClose,
  sections,
  unreadNotifications,
  businessName,
}: {
  open: boolean;
  onClose: () => void;
  sections: ReturnType<typeof visibleNavigation>;
  unreadNotifications: number;
  businessName?: string;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !node) return;

    const releaseScroll = lockBodyScroll();
    const releaseFocus = trapFocus(node);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseScroll();
      releaseFocus();
    };
  }, [open, node, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50" onClick={onClose} aria-hidden />

      <div
        ref={setNode}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] animate-slide-in-left flex-col bg-surface-card shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle px-4">
          <BrandLogo size={28} />
          <Button variant="ghost" size="sm" iconOnly icon="x" aria-label="Close navigation" onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1">
          <Sidebar
            sections={sections}
            badges={{ notifications: unreadNotifications }}
            variant="drawer"
            onNavigate={onClose}
            businessName={businessName}
          />
        </div>
      </div>
    </div>
  );
}
