<?php

declare(strict_types=1);

namespace App\Data;

use Illuminate\Support\Carbon;

/**
 * Validated input for recording a stock receipt.
 *
 * A plain readonly object rather than an array, so the inventory service has a
 * typed contract and controllers cannot smuggle extra keys into it.
 */
final readonly class StockInData
{
    public function __construct(
        public int $productId,
        public int $quantity,
        public ?int $supplierId = null,
        public ?string $batchNumber = null,
        public ?string $reference = null,
        public ?string $unitCost = null,
        public ?Carbon $receivedAt = null,
        public ?Carbon $expiresAt = null,
        public ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public static function fromValidated(array $validated): self
    {
        return new self(
            productId: (int) $validated['product_id'],
            quantity: (int) $validated['quantity'],
            supplierId: isset($validated['supplier_id']) ? (int) $validated['supplier_id'] : null,
            batchNumber: $validated['batch_number'] ?? null,
            reference: $validated['reference'] ?? null,
            unitCost: isset($validated['unit_cost']) ? (string) $validated['unit_cost'] : null,
            receivedAt: isset($validated['received_at']) ? Carbon::parse((string) $validated['received_at']) : null,
            expiresAt: isset($validated['expires_at']) ? Carbon::parse((string) $validated['expires_at']) : null,
            notes: $validated['notes'] ?? null,
        );
    }
}
