<?php

declare(strict_types=1);

namespace App\Data;

use Illuminate\Support\Carbon;

/**
 * Validated input for recording a stock withdrawal.
 *
 * Note there is no batch selector: which batches are consumed is decided by the
 * FIFO engine, never by the caller.
 */
final readonly class StockOutData
{
    public function __construct(
        public int $productId,
        public int $quantity,
        public ?string $reference = null,
        public ?string $reason = null,
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
            quantity: (int) $validated['quantity'],
            reference: $validated['reference'] ?? null,
            reason: $validated['reason'] ?? null,
            occurredAt: isset($validated['occurred_at']) ? Carbon::parse((string) $validated['occurred_at']) : null,
            notes: $validated['notes'] ?? null,
        );
    }
}
