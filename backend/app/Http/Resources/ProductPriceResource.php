<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ProductPrice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Reference pricing. Exposed separately from inventory so a client is never
 * tempted to compute a quantity from it.
 *
 * @mixin ProductPrice
 */
final class ProductPriceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'reference_price' => $this->reference_price,
            'currency' => $this->currency,
            'effective_from' => $this->effective_from?->toDateString(),
            'source' => $this->source,
            'notes' => $this->notes,
            'image_url' => $this->image_path !== null ? asset('storage/'.$this->image_path) : null,
            'product' => new ProductSummaryResource($this->whenLoaded('product')),
            'updated_by' => new UserSummaryResource($this->whenLoaded('updatedBy')),
            'history' => ProductPriceHistoryResource::collection($this->whenLoaded('history')),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
