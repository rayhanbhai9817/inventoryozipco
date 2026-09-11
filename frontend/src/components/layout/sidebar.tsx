'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CountBubble } from '@/components/ui/badge';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Icon } from '@/components/ui/icon';
import { isNavItemActive, type NavSection } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Dashboard sidebar.
 *
 * Renders only the sections the signed-in user has permission for — the filtering
 * happens in `visibleNavigation()`, so this component never decides access, it
 * just draws what it is given.
 *
 * Collapsible to an icon rail on wide screens, for people who want the extra
 * horizontal room on a dense table.
 */

export interface SidebarProps {
  sections: NavSection[];
  badges?: { notifications?: number; lowStock?: number };
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Rendered inside the mobile drawer, where the brand header is separate. */
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
  businessName?: string;
}

export function Sidebar({
  sections,
  badges,
  collapsed = false,
  onToggleCollapsed,
  variant = 'desktop',
  onNavigate,
  businessName,
}: SidebarProps) {
  const pathname = usePathname();
  const isDrawer = variant === 'drawer';
  const showLabels = isDrawer || !collapsed;

  return (
    <div
      className={cn(
        'flex h-full flex-col border-border-subtle bg-surface-card',
        !isDrawer && 'border-r',
      )}
    >
      {/* ---------- Brand ---------- */}
      {!isDrawer ? (
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-border-subtle',
            collapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          <Link href="/dashboard" className="min-w-0 rounded-lg" aria-label="Ozipco Inventory dashboard">
            <BrandLogo size={28} showWordmark={showLabels} />
          </Link>
          {onToggleCollapsed && showLabels ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Collapse sidebar"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
            >
              <Icon name="chevron-left" size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ---------- Navigation ---------- */}
      <nav
        aria-label="Dashboard"
        className={cn('min-h-0 flex-1 space-y-5 overflow-y-auto py-4', collapsed && !isDrawer ? 'px-2' : 'px-3')}
      >
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? `section-${sectionIndex}`}>
            {section.label && showLabels ? (
              <p className="mb-1.5 px-2.5 text-[0.6875rem] font-semibold tracking-wider text-content-tertiary uppercase">
                {section.label}
              </p>
            ) : section.label && !showLabels ? (
              <div className="mx-2 mb-2 h-px bg-border-subtle" aria-hidden />
            ) : null}

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isNavItemActive(item, pathname);
                const badgeCount = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      title={showLabels ? undefined : item.label}
                      className={cn(
                        'group relative flex items-center rounded-lg text-[0.8125rem] font-medium transition-colors',
                        showLabels ? 'gap-2.5 px-2.5 py-2' : 'justify-center px-0 py-2.5',
                        active
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200'
                          : 'text-content-secondary hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised',
                      )}
                    >
                      {/* Active marker on the left edge — reads instantly even in
                          the collapsed rail. */}
                      {active ? (
                        <span
                          className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-400"
                          aria-hidden
                        />
                      ) : null}

                      <Icon name={item.icon} size={17} className="shrink-0" />

                      {showLabels ? (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {badgeCount > 0 ? (
                            <CountBubble
                              count={badgeCount}
                              tone={item.badgeKey === 'notifications' ? 'critical' : 'neutral'}
                            />
                          ) : null}
                        </>
                      ) : badgeCount > 0 ? (
                        <span
                          className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-critical-500"
                          aria-hidden
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ---------- Footer ---------- */}
      <div
        className={cn(
          'shrink-0 border-t border-border-subtle',
          collapsed && !isDrawer ? 'p-2' : 'p-3',
        )}
      >
        {showLabels ? (
          <div className="rounded-xl bg-surface-sunken/70 p-3">
            <p className="truncate text-[0.6875rem] font-semibold tracking-wide text-content-tertiary uppercase">
              Workspace
            </p>
            <p className="mt-1 truncate text-[0.8125rem] font-medium text-content-primary">
              {businessName ?? 'Your business'}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] text-content-tertiary">
              <Icon name="lock" size={11} />
              Isolated from other businesses
            </p>
          </div>
        ) : onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            className="inline-flex h-9 w-full items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
