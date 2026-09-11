'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CountBubble } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/lib/theme';
import { visibleQuickActions } from '@/lib/navigation';
import type { PermissionKey, User } from '@/types/api';
import { cn } from '@/lib/utils';

import { GlobalSearch } from '@/components/layout/global-search';

/**
 * Dashboard topbar: global search, quick-create, notifications, theme, account.
 *
 * Sticky, with a translucent backdrop, so the search field and the notification
 * badge stay reachable however far down a long table the user has scrolled.
 */
export interface TopbarProps {
  user: User;
  unreadNotifications: number;
  onOpenMobileNav: () => void;
  onSignOut: () => void;
}

export function Topbar({ user, unreadNotifications, onOpenMobileNav, onSignOut }: TopbarProps) {
  const router = useRouter();
  const { preference, resolved, setPreference } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  const quickActions = visibleQuickActions(user.permissions);

  // ⌘K / Ctrl+K opens search from anywhere — the shortcut people reach for first.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-page/85 px-3 backdrop-blur-xl sm:gap-3 sm:px-5">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="menu"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        />

        {/* Search: a real field on desktop, an icon on phones where the space
            is better spent on content. */}
        <button
          ref={searchButtonRef}
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden h-9 max-w-sm flex-1 items-center gap-2.5 rounded-lg bg-surface-card px-3 text-left text-[0.8125rem] text-content-tertiary ring-1 ring-border-default ring-inset transition-colors hover:ring-border-strong sm:flex"
        >
          <Icon name="search" size={16} />
          <span className="flex-1 truncate">Search products, suppliers, references…</span>
          <kbd className="hidden shrink-0 rounded border border-border-default bg-surface-sunken px-1.5 py-0.5 font-sans text-[0.625rem] font-medium text-content-tertiary lg:inline-block">
            ⌘K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="search"
          className="sm:hidden"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
        />

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {quickActions.length > 0 ? (
            <Dropdown
              align="end"
              label="Create"
              items={quickActions.map((action) => ({
                label: action.label,
                icon: action.icon,
                href: action.href,
              }))}
              trigger={
                <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[0.8125rem] font-medium text-white ring-1 ring-brand-700/60 ring-inset transition-colors hover:bg-brand-700">
                  <Icon name="plus" size={16} />
                  <span className="hidden sm:inline">New</span>
                  <Icon name="chevron-down" size={14} className="hidden opacity-70 sm:inline" />
                </span>
              }
            />
          ) : null}

          <Link
            href="/notifications"
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications} unread`
                : 'Notifications'
            }
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
          >
            <Icon name="bell" size={18} />
            {unreadNotifications > 0 ? (
              <CountBubble
                count={unreadNotifications}
                className="absolute -top-0.5 -right-0.5 ring-2 ring-surface-page"
              />
            ) : null}
          </Link>

          <Dropdown
            align="end"
            label="Theme"
            items={(['light', 'dark', 'system'] as const).map((option) => ({
              label: option === 'system' ? 'Match system' : option === 'light' ? 'Light' : 'Dark',
              icon: option === 'light' ? 'sun' : option === 'dark' ? 'moon' : 'gauge',
              hint: preference === option ? '✓' : undefined,
              onClick: () => setPreference(option),
            }))}
            trigger={
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
                aria-label="Theme"
              >
                <Icon name={resolved === 'dark' ? 'moon' : 'sun'} size={18} />
              </span>
            }
          />

          <Dropdown
            align="end"
            menuClassName="min-w-64"
            items={[
              { label: 'Your profile', icon: 'user', href: '/settings' },
              { label: 'Security', icon: 'lock', href: '/settings/security' },
              { label: 'Notification preferences', icon: 'bell', href: '/settings/notifications' },
              'separator',
              ...(user.permissions?.includes('settings.view' as PermissionKey)
                ? ([{ label: 'Business settings', icon: 'building', href: '/settings/business' }] as const)
                : []),
              { label: 'Sign out', icon: 'log-out', destructive: true, onClick: onSignOut },
            ]}
            trigger={
              <span className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-ink-100 dark:hover:bg-surface-raised">
                <Avatar user={user} />
                <span className="hidden min-w-0 text-left lg:block">
                  <span className="block max-w-[9rem] truncate text-[0.8125rem] leading-tight font-medium text-content-primary">
                    {user.name}
                  </span>
                  <span className="block text-[0.6875rem] leading-tight text-content-tertiary">
                    {user.role.label}
                  </span>
                </span>
                <Icon
                  name="chevron-down"
                  size={14}
                  className="hidden shrink-0 text-content-tertiary lg:block"
                />
              </span>
            }
          />
        </div>
      </header>

      <GlobalSearch
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          searchButtonRef.current?.focus();
        }}
        onNavigate={(href) => {
          setSearchOpen(false);
          router.push(href);
        }}
        permissions={user.permissions}
      />
    </>
  );
}

/** Initials avatar. No image upload in the demo, and initials never fail to load. */
export function Avatar({
  user,
  size = 32,
  className,
}: {
  user: Pick<User, 'name' | 'initials' | 'avatar_url'>;
  size?: number;
  className?: string;
}) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars come from
      // the API at arbitrary origins; next/image would need every host allow-listed.
      <img
        src={user.avatar_url}
        alt=""
        width={size}
        height={size}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {user.initials}
    </span>
  );
}
