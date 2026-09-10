<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ProductPriceHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProductPriceHistory
 */
final class ProductPriceHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_price' => $this->reference_price,
            'previous_price' => $this->previous_price,
            'change_percentage' => $this->changePercentage(),
            'currency' => $this->currency,
            'effective_from' => $this->effective_from?->toDateString(),
            'effective_to' => $this->effective_to?->toDateString(),
            'is_current' => $this->effective_to === null,
            'source' => $this->source,
            'notes' => $this->notes,
            'image_url' => $this->image_path !== null ? asset('storage/'.$this->image_path) : null,
            'product' => new ProductSummaryResource($this->whenLoaded('product')),
            'recorded_by' => new UserSummaryResource($this->whenLoaded('recordedBy')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
