'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { TabLinks } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/states';
import { useAuth } from '@/lib/auth';
import { SETTINGS_TABS } from '@/lib/navigation';

/**
 * Settings shell.
 *
 * The sub-navigation is filtered by permission, so a Staff member sees only
 * Profile, Security and Notifications — the three that are always their own —
 * while an Owner also gets Business and Roles.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { can } = useAuth();

  const tabs = SETTINGS_TABS.filter(
    (tab) => tab.permissions.length === 0 || tab.permissions.some((permission) => can(permission)),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Your profile, your security, and — if you are an Owner — how the business is configured."
      />

      <TabLinks
        tabs={tabs.map((tab) => ({ href: tab.href, label: tab.label, icon: tab.icon }))}
        currentPath={pathname}
        aria-label="Settings sections"
      />

      <div className="max-w-3xl">{children}</div>
    </div>
  );
}
