<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\InventoryLedgerEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryLedgerEntry
 */
final class LedgerEntryResource extends JsonResource
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
            'quantity_change' => $this->quantity_change,
            'balance_after' => $this->balance_after,
            'reference' => $this->reference,
            'notes' => $this->notes,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'meta' => $this->meta,
            'product' => new ProductSummaryResource($this->whenLoaded('product')),
            'supplier' => new SupplierSummaryResource($this->whenLoaded('supplier')),
            'batch' => new StockBatchSummaryResource($this->whenLoaded('batch')),
            'user' => new UserSummaryResource($this->whenLoaded('user')),
            'movement_id' => $this->stock_movement_id,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
