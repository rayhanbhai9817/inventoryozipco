<?php

declare(strict_types=1);

namespace App\Enums;

enum NotificationType: string
{
    case LowStock = 'low_stock';
    case OutOfStock = 'out_of_stock';
    case StockInRecorded = 'stock_in_recorded';
    case StockOutRecorded = 'stock_out_recorded';
    case InventoryAdjusted = 'inventory_adjusted';
    case MissingSupplier = 'missing_supplier';
    case MissingPriceReference = 'missing_price_reference';
    case UserInvited = 'user_invited';
    case RoleChanged = 'role_changed';
    case AdminActivity = 'admin_activity';

    public function severity(): NotificationSeverity
    {
        return match ($this) {
            self::OutOfStock => NotificationSeverity::Critical,
            self::LowStock, self::MissingSupplier, self::MissingPriceReference => NotificationSeverity::Warning,
            self::StockInRecorded, self::StockOutRecorded, self::InventoryAdjusted => NotificationSeverity::Success,
            default => NotificationSeverity::Info,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::LowStock => 'Low stock',
            self::OutOfStock => 'Out of stock',
            self::StockInRecorded => 'Stock in recorded',
            self::StockOutRecorded => 'Stock out recorded',
            self::InventoryAdjusted => 'Inventory adjusted',
            self::MissingSupplier => 'Product without supplier',
            self::MissingPriceReference => 'Product without price reference',
            self::UserInvited => 'User invited',
            self::RoleChanged => 'Role changed',
            self::AdminActivity => 'Administrative activity',
        };
    }

    /**
     * Notification types a user can individually mute in their preferences.
     */
    public function isMutable(): bool
    {
        return $this !== self::AdminActivity;
    }
}
