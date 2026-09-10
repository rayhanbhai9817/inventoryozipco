<?php

declare(strict_types=1);

namespace App\Data;

use Illuminate\Support\Carbon;

/**
 * Validated input for an inventory adjustment (stock count correction,
 * shrinkage, damage, found stock).
 *
 * `quantityDelta` is signed: a positive value opens a new batch, a negative one
 * consumes existing batches FIFO.
 */
final readonly class StockAdjustmentData
{
    public function __construct(
        public int $productId,
        public int $quantityDelta,
        public string $reason,
        public ?string $reference = null,
        public ?Carbon $occurredAt = null,
        public ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     */
    public static function fromValidated(array $validated): self
    {
        return new self(
            productId: (int) $validated['product_id'],
            quantityDelta: (int) $validated['quantity_delta'],
            reason: (string) $validated['reason'],
            reference: $validated['reference'] ?? null,
            occurredAt: isset($validated['occurred_at']) ? Carbon::parse((string) $validated['occurred_at']) : null,
            notes: $validated['notes'] ?? null,
        );
    }

    public function isIncrease(): bool
    {
        return $this->quantityDelta > 0;
    }
}
