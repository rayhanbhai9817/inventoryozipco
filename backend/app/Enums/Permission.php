<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Every fine-grained capability in the platform.
 *
 * Permissions are checked server-side through policies and the
 * `permission:<key>` route middleware. The frontend mirrors the same keys only
 * to decide what to *render* — it is never the authority.
 */
enum Permission: string
{
    case DashboardView = 'dashboard.view';

    case ProductsView = 'products.view';
    case ProductsManage = 'products.manage';
    case ProductsDelete = 'products.delete';

    case CategoriesView = 'categories.view';
    case CategoriesManage = 'categories.manage';

    case SuppliersView = 'suppliers.view';
    case SuppliersManage = 'suppliers.manage';

    case InventoryView = 'inventory.view';
    case StockInCreate = 'inventory.stock-in';
    case StockOutCreate = 'inventory.stock-out';
    case InventoryAdjust = 'inventory.adjust';

    case ReportsView = 'reports.view';
    case ReportsExport = 'reports.export';

    case PricesView = 'prices.view';
    case PricesManage = 'prices.manage';

    case NotificationsView = 'notifications.view';

    case AuditLogsView = 'audit-logs.view';

    case UsersView = 'users.view';
    case UsersManage = 'users.manage';

    case SettingsView = 'settings.view';
    case SettingsManage = 'settings.manage';
    case RolesManage = 'roles.manage';

    public function label(): string
    {
        return match ($this) {
            self::DashboardView => 'View dashboard',
            self::ProductsView => 'View products',
            self::ProductsManage => 'Create and edit products',
            self::ProductsDelete => 'Archive and delete products',
            self::CategoriesView => 'View categories',
            self::CategoriesManage => 'Manage categories',
            self::SuppliersView => 'View suppliers',
            self::SuppliersManage => 'Manage suppliers',
            self::InventoryView => 'View inventory and ledger',
            self::StockInCreate => 'Record stock in',
            self::StockOutCreate => 'Record stock out',
            self::InventoryAdjust => 'Adjust inventory',
            self::ReportsView => 'View reports',
            self::ReportsExport => 'Export reports',
            self::PricesView => 'View price catalogue',
            self::PricesManage => 'Manage price catalogue',
            self::NotificationsView => 'View notifications',
            self::AuditLogsView => 'View audit logs',
            self::UsersView => 'View users',
            self::UsersManage => 'Manage users and roles',
            self::SettingsView => 'View settings',
            self::SettingsManage => 'Manage business settings',
            self::RolesManage => 'Manage roles and permissions',
        };
    }

    /**
     * Grouping used by the Settings → Roles & permissions screen.
     */
    public function group(): string
    {
        return match ($this) {
            self::DashboardView => 'Dashboard',
            self::ProductsView, self::ProductsManage, self::ProductsDelete => 'Products',
            self::CategoriesView, self::CategoriesManage => 'Categories',
            self::SuppliersView, self::SuppliersManage => 'Suppliers',
            self::InventoryView, self::StockInCreate, self::StockOutCreate, self::InventoryAdjust => 'Inventory',
            self::ReportsView, self::ReportsExport => 'Reports',
            self::PricesView, self::PricesManage => 'Price catalogue',
            self::NotificationsView => 'Notifications',
            self::AuditLogsView => 'Audit',
            self::UsersView, self::UsersManage => 'Users',
            self::SettingsView, self::SettingsManage, self::RolesManage => 'Settings',
        };
    }

    /**
     * Permissions that may never be granted to a non-owner role. Owners always
     * hold every permission, so these stay out of the editable matrix.
     */
    public function isOwnerOnly(): bool
    {
        return in_array($this, [
            self::RolesManage,
            self::SettingsManage,
            self::AuditLogsView,
            self::UsersManage,
        ], true);
    }

    /**
     * @return array<int, string>
     */
    public static function keys(): array
    {
        return array_map(static fn (self $permission): string => $permission->value, self::cases());
    }
}
