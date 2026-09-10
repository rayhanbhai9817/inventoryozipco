<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Units of measure a product can be counted in.
 *
 * Quantities across the platform are whole numbers of the product's unit (see
 * docs/ARCHITECTURE.md → "Quantities are integers"). Businesses that need
 * fractional weights model them by choosing a smaller unit, e.g. grams.
 */
enum ProductUnit: string
{
    case Each = 'each';
    case Box = 'box';
    case Case_ = 'case';
    case Pallet = 'pallet';
    case Pack = 'pack';
    case Gram = 'gram';
    case Kilogram = 'kilogram';
    case Litre = 'litre';
    case Millilitre = 'millilitre';
    case Metre = 'metre';

    public function label(): string
    {
        return match ($this) {
            self::Each => 'Each',
            self::Box => 'Box',
            self::Case_ => 'Case',
            self::Pallet => 'Pallet',
            self::Pack => 'Pack',
            self::Gram => 'Gram',
            self::Kilogram => 'Kilogram',
            self::Litre => 'Litre',
            self::Millilitre => 'Millilitre',
            self::Metre => 'Metre',
        };
    }

    public function abbreviation(): string
    {
        return match ($this) {
            self::Each => 'ea',
            self::Box => 'box',
            self::Case_ => 'cs',
            self::Pallet => 'plt',
            self::Pack => 'pk',
            self::Gram => 'g',
            self::Kilogram => 'kg',
            self::Litre => 'L',
            self::Millilitre => 'mL',
            self::Metre => 'm',
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $unit): string => $unit->value, self::cases());
    }
}
