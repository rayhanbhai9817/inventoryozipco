<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compact product shape for nested references — a movement's product, a ledger
 * line's product, a price catalogue row's product.
 *
 * Kept deliberately small so the long list endpoints (ledger, movements,
 * reports) stay cheap: the matching eager loads select only
 * `id, name, sku, unit, category_id`, and this resource reads nothing else.
 * Use {@see ProductResource} where the full product row is loaded.
 *
 * @mixin Product
 */
final class ProductSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit' => [
                'value' => $this->unit->value,
                'label' => $this->unit->label(),
                'abbreviation' => $this->unit->abbreviation(),
            ],
            'category' => new CategoryResource($this->whenLoaded('category')),
        ];
    }
}
