<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
final class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $status = $this->stockStatus();

        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'description' => $this->description,
            'unit' => [
                'value' => $this->unit->value,
                'label' => $this->unit->label(),
                'abbreviation' => $this->unit->abbreviation(),
            ],
            'image_url' => $this->image_path !== null ? asset('storage/'.$this->image_path) : null,
            'minimum_stock_level' => $this->minimum_stock_level,
            'reorder_quantity' => $this->reorder_quantity,
            'quantity_on_hand' => $this->quantity_on_hand,
            'stock_status' => [
                'value' => $status->value,
                'label' => $status->label(),
            ],
            'is_active' => $this->is_active,
            'is_archived' => $this->isArchived(),
            'archived_at' => $this->archived_at?->toIso8601String(),
            'category' => new CategoryResource($this->whenLoaded('category')),
            'suppliers' => SupplierSummaryResource::collection($this->whenLoaded('suppliers')),
            'price' => new ProductPriceResource($this->whenLoaded('price')),
            'open_batches' => StockBatchResource::collection($this->whenLoaded('openBatches')),
            'batch_count' => $this->whenCounted('stockBatches'),
            'movement_count' => $this->whenCounted('stockMovements'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
