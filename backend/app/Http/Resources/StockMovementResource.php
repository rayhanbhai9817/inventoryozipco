<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockMovement
 */
final class StockMovementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => [
                'value' => $this->type->value,
                'label' => $this->type->label(),
            ],
            'direction' => $this->direction,
            'quantity' => $this->quantity,
            'signed_quantity' => $this->signedQuantity(),
            'balance_after' => $this->balance_after,
            'reference' => $this->reference,
            'reason' => $this->reason,
            'notes' => $this->notes,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'product' => new ProductSummaryResource($this->whenLoaded('product')),
            'supplier' => new SupplierSummaryResource($this->whenLoaded('supplier')),
            'batch' => new StockBatchSummaryResource($this->whenLoaded('batch')),
            // For outbound movements: which batches FIFO consumed.
            'allocations' => $this->whenLoaded(
                'allocations',
                fn () => $this->allocations->map(fn ($allocation): array => [
                    'batch_id' => $allocation->stock_batch_id,
                    'batch_number' => $allocation->batch?->batch_number,
                    'batch_received_at' => $allocation->batch?->received_at?->toIso8601String(),
                    'quantity' => $allocation->quantity,
                ])->all()
            ),
            'created_by' => new UserSummaryResource($this->whenLoaded('creator')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
