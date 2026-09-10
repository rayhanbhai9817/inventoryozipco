<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\StockBatch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockBatch
 */
final class StockBatchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batch_number' => $this->batch_number,
            'reference' => $this->reference,
            'quantity_received' => $this->quantity_received,
            'quantity_remaining' => $this->quantity_remaining,
            'quantity_consumed' => $this->quantityConsumed(),
            // Reference information captured at receipt. Not used for valuation.
            'unit_cost' => $this->unit_cost,
            'currency' => $this->currency,
            'received_at' => $this->received_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toDateString(),
            'is_expired' => $this->isExpired(),
            'is_depleted' => $this->isDepleted(),
            'notes' => $this->notes,
            'product' => new ProductSummaryResource($this->whenLoaded('product')),
            'supplier' => new SupplierSummaryResource($this->whenLoaded('supplier')),
            'created_by' => new UserSummaryResource($this->whenLoaded('creator')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
