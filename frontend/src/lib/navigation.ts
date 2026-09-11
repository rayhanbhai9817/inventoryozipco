import type { IconName } from '@/components/ui/icon';
import type { PermissionKey } from '@/types/api';

/**
 * The dashboard navigation.
 *
 * Each item declares the permissions that make it relevant. `visibleNavigation()`
 * filters by what the signed-in user actually holds, so a Staff member never sees
 * a Users link — but note that hiding it is a courtesy, not the control: the
 * backend re-checks the same permission on every request.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** The user needs at least one of these to see the item. */
  permissions: PermissionKey[];
  /** Matches nested routes too, e.g. /products/12 highlights Products. */
  matchPrefix?: boolean;
  /** Key into the badge counts passed to the sidebar. */
  badgeKey?: 'notifications' | 'lowStock';
}

export interface NavSection {
  /** Omitted for the first group, which needs no heading. */
  label?: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'gauge',
        permissions: ['dashboard.view'],
      },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      {
        label: 'Products',
        href: '/products',
        icon: 'package',
        permissions: ['products.view'],
        matchPrefix: true,
      },
      {
        label: 'Categories',
        href: '/categories',
        icon: 'tag',
        permissions: ['categories.view'],
      },
      {
        label: 'Suppliers',
        href: '/suppliers',
        icon: 'truck',
        permissions: ['suppliers.view'],
        matchPrefix: true,
      },
      {
        label: 'Price catalogue',
        href: '/price-catalog',
        icon: 'file-text',
        permissions: ['prices.view'],
      },
    ],
  },
  {
    label: 'Inventory',
    items: [
      {
        label: 'Inventory',
        href: '/inventory',
        icon: 'boxes',
        permissions: ['inventory.view'],
        badgeKey: 'lowStock',
      },
      {
        label: 'Stock in',
        href: '/stock-in',
        icon: 'arrow-down-right',
        permissions: ['inventory.stock-in', 'inventory.view'],
      },
      {
        label: 'Stock out',
        href: '/stock-out',
        icon: 'arrow-up-right',
        permissions: ['inventory.stock-out', 'inventory.view'],
      },
      {
        label: 'Ledger',
        href: '/ledger',
        icon: 'layers',
        permissions: ['inventory.view'],
      },
    ],
  },
  {
    label: 'Insight',
    items: [
      {
        label: 'Reports',
        href: '/reports',
        icon: 'activity',
        permissions: ['reports.view'],
        matchPrefix: true,
      },
      {
        label: 'Notifications',
        href: '/notifications',
        icon: 'bell',
        permissions: ['notifications.view'],
        badgeKey: 'notifications',
      },
      {
        label: 'Audit log',
        href: '/audit-logs',
        icon: 'history',
        permissions: ['audit-logs.view'],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Users',
        href: '/users',
        icon: 'users',
        permissions: ['users.view'],
        matchPrefix: true,
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: 'settings',
        permissions: ['settings.view'],
        matchPrefix: true,
      },
    ],
  },
];

/**
 * Sections containing at least one item this user may see, with the other items
 * stripped. Empty sections are dropped so no heading is left stranded.
 */
export function visibleNavigation(permissions: PermissionKey[] | undefined): NavSection[] {
  if (!permissions) return [];

  const held = new Set(permissions);

  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.permissions.some((key) => held.has(key))),
  })).filter((section) => section.items.length > 0);
}

/** Whether a nav item should read as current for the given pathname. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;

  return Boolean(item.matchPrefix) && pathname.startsWith(`${item.href}/`);
}

/**
 * Quick actions in the topbar's "New" menu, filtered the same way.
 */
export interface QuickAction {
  label: string;
  href: string;
  icon: IconName;
  permissions: PermissionKey[];
  description: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Record stock in',
    href: '/stock-in?new=1',
    icon: 'arrow-down-right',
    permissions: ['inventory.stock-in'],
    description: 'Receive inventory and open a new batch',
  },
  {
    label: 'Record stock out',
    href: '/stock-out?new=1',
    icon: 'arrow-up-right',
    permissions: ['inventory.stock-out'],
    description: 'Issue inventory, consumed oldest batch first',
  },
  {
    label: 'New product',
    href: '/products?new=1',
    icon: 'package',
    permissions: ['products.manage'],
    description: 'Add an item to the catalogue',
  },
  {
    label: 'New supplier',
    href: '/suppliers?new=1',
    icon: 'truck',
    permissions: ['suppliers.manage'],
    description: 'Add a supplier you buy from',
  },
  {
    label: 'New category',
    href: '/categories?new=1',
    icon: 'tag',
    permissions: ['categories.manage'],
    description: 'Group products for reporting',
  },
  {
    label: 'Invite a user',
    href: '/users?new=1',
    icon: 'user-plus',
    permissions: ['users.manage'],
    description: 'Give a colleague access',
  },
];

export function visibleQuickActions(permissions: PermissionKey[] | undefined): QuickAction[] {
  if (!permissions) return [];

  const held = new Set(permissions);

  return QUICK_ACTIONS.filter((action) => action.permissions.some((key) => held.has(key)));
}

/** Settings sub-navigation. */
export const SETTINGS_TABS: Array<{
  label: string;
  href: string;
  icon: IconName;
  permissions: PermissionKey[];
}> = [
  { label: 'Profile', href: '/settings', icon: 'user', permissions: [] },
  { label: 'Security', href: '/settings/security', icon: 'lock', permissions: [] },
  {
    label: 'Notifications',
    href: '/settings/notifications',
    icon: 'bell',
    permissions: [],
  },
  {
    label: 'Business',
    href: '/settings/business',
    icon: 'building',
    permissions: ['settings.view'],
  },
  {
    label: 'Roles & permissions',
    href: '/settings/roles',
    icon: 'shield',
    permissions: ['roles.manage'],
  },
];

/** Report definitions — the Reports landing page and its detail routes. */
export interface ReportDefinition {
  slug: string;
  label: string;
  description: string;
  icon: IconName;
}

export const REPORTS: ReportDefinition[] = [
  {
    slug: 'inventory-summary',
    label: 'Inventory summary',
    description: 'Every product with its current quantity, minimum level and stock status.',
    icon: 'boxes',
  },
  {
    slug: 'stock-in',
    label: 'Stock in',
    description: 'Receipts over a period, by product, supplier and reference.',
    icon: 'arrow-down-right',
  },
  {
    slug: 'stock-out',
    label: 'Stock out',
    description: 'Withdrawals over a period, with the balance after each one.',
    icon: 'arrow-up-right',
  },
  {
    slug: 'product-movement',
    label: 'Product movement',
    description: 'All movement types together — receipts, withdrawals and adjustments.',
    icon: 'activity',
  },
  {
    slug: 'low-stock',
    label: 'Low stock',
    description: 'Products at or below their minimum level, ordered by urgency.',
    icon: 'alert-triangle',
  },
  {
    slug: 'out-of-stock',
    label: 'Out of stock',
    description: 'Products with nothing left on hand.',
    icon: 'alert-circle',
  },
  {
    slug: 'suppliers',
    label: 'Supplier activity',
    description: 'Units supplied, batches received and products linked per supplier.',
    icon: 'truck',
  },
  {
    slug: 'ledger',
    label: 'Inventory ledger',
    description: 'The immutable record of every quantity change, with running balances.',
    icon: 'layers',
  },
  {
    slug: 'price-history',
    label: 'Price reference history',
    description: 'Every reference price that has been in effect, and when it changed.',
    icon: 'file-text',
  },
];
