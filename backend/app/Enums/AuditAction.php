<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Auditable actions. The list is closed so that audit queries and the audit
 * log filter UI stay stable and meaningful.
 */
enum AuditAction: string
{
    case Login = 'auth.login';
    case LoginFailed = 'auth.login_failed';
    case Logout = 'auth.logout';
    case BusinessRegistered = 'business.registered';
    case BusinessUpdated = 'business.updated';

    case ProductCreated = 'product.created';
    case ProductUpdated = 'product.updated';
    case ProductArchived = 'product.archived';
    case ProductRestored = 'product.restored';
    case ProductDeleted = 'product.deleted';

    case CategoryCreated = 'category.created';
    case CategoryUpdated = 'category.updated';
    case CategoryArchived = 'category.archived';
    case CategoryDeleted = 'category.deleted';

    case SupplierCreated = 'supplier.created';
    case SupplierUpdated = 'supplier.updated';
    case SupplierArchived = 'supplier.archived';
    case SupplierLinkedToProduct = 'supplier.linked_to_product';
    case SupplierUnlinkedFromProduct = 'supplier.unlinked_from_product';

    case StockIn = 'inventory.stock_in';
    case StockOut = 'inventory.stock_out';
    case InventoryAdjusted = 'inventory.adjusted';

    case PriceCreated = 'price.created';
    case PriceUpdated = 'price.updated';
    case PriceDeleted = 'price.deleted';

    case UserInvited = 'user.invited';
    case UserUpdated = 'user.updated';
    case UserActivated = 'user.activated';
    case UserDeactivated = 'user.deactivated';
    case UserRoleChanged = 'user.role_changed';
    case UserPermissionsChanged = 'user.permissions_changed';
    case RolePermissionsChanged = 'role.permissions_changed';

    case SettingsUpdated = 'settings.updated';
    case PasswordChanged = 'security.password_changed';

    public function label(): string
    {
        return ucfirst(str_replace(['.', '_'], [' · ', ' '], $this->value));
    }

    /**
     * Broad bucket used for filtering in the audit log UI.
     */
    public function category(): string
    {
        return str_contains($this->value, '.')
            ? (string) strtok($this->value, '.')
            : 'other';
    }
}
