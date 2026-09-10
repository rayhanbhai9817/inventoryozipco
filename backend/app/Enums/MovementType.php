<?php

declare(strict_types=1);

namespace App\Enums;

use App\Models\StockMovement;

/**
 * The three ways inventory can change. Every change is recorded as a
 * {@see StockMovement} plus an immutable ledger entry.
 */
enum MovementType: string
{
    case StockIn = 'stock_in';
    case StockOut = 'stock_out';
    case Adjustment = 'adjustment';

    public function label(): string
    {
        return match ($this) {
            self::StockIn => 'Stock in',
            self::StockOut => 'Stock out',
            self::Adjustment => 'Adjustment',
        };
    }

    /**
     * Whether the movement adds to available quantity. Adjustments can go
     * either way, so their direction is carried on the movement itself.
     */
    public function isInbound(): bool
    {
        return $this === self::StockIn;
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $type): string => $type->value, self::cases());
    }
}
