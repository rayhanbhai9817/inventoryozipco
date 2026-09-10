<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compact supplier shape for nested references. Matching eager loads select
 * `id, name` only; use {@see SupplierResource} where the full row is loaded.
 *
 * @mixin Supplier
 */
final class SupplierSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            // Present only when reached through a product's `suppliers`
            // relationship, which carries the link attributes on the pivot.
            'link' => $this->whenPivotLoaded('supplier_product', fn (): array => [
                'supplier_sku' => $this->pivot->supplier_sku,
                'lead_time_days' => $this->pivot->lead_time_days,
                'minimum_order_quantity' => $this->pivot->minimum_order_quantity,
                'is_preferred' => (bool) $this->pivot->is_preferred,
            ]),
        ];
    }
}
