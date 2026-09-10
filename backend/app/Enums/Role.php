<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The canonical set of roles a user can hold inside a business.
 *
 * Roles are deliberately a closed enum: they are the coarse authorisation
 * boundary enforced everywhere in the application. Fine-grained capability
 * tuning happens through {@see Permission} grants attached to a role (or
 * overridden per user), not by inventing new roles at runtime.
 */
enum Role: string
{
    case Owner = 'owner';
    case Manager = 'manager';
    case Staff = 'staff';

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Owner',
            self::Manager => 'Manager',
            self::Staff => 'Staff',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Owner => 'Full access to the business, including users, billing details, settings and audit history.',
            self::Manager => 'Runs day-to-day operations: products, suppliers, stock movements and reports.',
            self::Staff => 'Records stock movements and views inventory. No administrative access.',
        };
    }

    /**
     * Owners are unconditionally authorised inside their own business.
     */
    public function isPrivileged(): bool
    {
        return $this === self::Owner;
    }

    /**
     * Roles this role is allowed to assign to other users.
     *
     * @return array<int, self>
     */
    public function assignableRoles(): array
    {
        return match ($this) {
            self::Owner => [self::Owner, self::Manager, self::Staff],
            self::Manager => [self::Staff],
            self::Staff => [],
        };
    }

    /**
     * The permission set granted to this role when a business is created.
     *
     * @return array<int, string>
     */
    public function defaultPermissions(): array
    {
        return match ($this) {
            self::Owner => Permission::keys(),
            self::Manager => [
                Permission::DashboardView->value,
                Permission::ProductsView->value,
                Permission::ProductsManage->value,
                Permission::CategoriesView->value,
                Permission::CategoriesManage->value,
                Permission::SuppliersView->value,
                Permission::SuppliersManage->value,
                Permission::InventoryView->value,
                Permission::StockInCreate->value,
                Permission::StockOutCreate->value,
                Permission::InventoryAdjust->value,
                Permission::ReportsView->value,
                Permission::ReportsExport->value,
                Permission::PricesView->value,
                Permission::PricesManage->value,
                Permission::NotificationsView->value,
                Permission::UsersView->value,
            ],
            self::Staff => [
                Permission::DashboardView->value,
                Permission::ProductsView->value,
                Permission::CategoriesView->value,
                Permission::SuppliersView->value,
                Permission::InventoryView->value,
                Permission::StockInCreate->value,
                Permission::StockOutCreate->value,
                Permission::NotificationsView->value,
            ],
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $role): string => $role->value, self::cases());
    }
}
