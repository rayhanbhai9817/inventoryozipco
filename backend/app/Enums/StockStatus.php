<?php

declare(strict_types=1);

namespace App\Enums;

enum StockStatus: string
{
    case InStock = 'in_stock';
    case LowStock = 'low_stock';
    case OutOfStock = 'out_of_stock';

    public static function forQuantity(int $quantityOnHand, int $minimumStockLevel): self
    {
        if ($quantityOnHand <= 0) {
            return self::OutOfStock;
        }

        if ($minimumStockLevel > 0 && $quantityOnHand <= $minimumStockLevel) {
            return self::LowStock;
        }

        return self::InStock;
    }

    public function label(): string
    {
        return match ($this) {
            self::InStock => 'In stock',
            self::LowStock => 'Low stock',
            self::OutOfStock => 'Out of stock',
        };
    }
}
