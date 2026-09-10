<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Supplier
 */
final class SupplierResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'contact_name' => $this->contact_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'website' => $this->website,
            'address' => [
                'line1' => $this->address_line1,
                'line2' => $this->address_line2,
                'city' => $this->city,
                'state' => $this->state,
                'postal_code' => $this->postal_code,
                'country' => $this->country,
                'formatted' => $this->formattedAddress(),
            ],
            'default_lead_time_days' => $this->default_lead_time_days,
            'notes' => $this->notes,
            'is_active' => $this->is_active,
            'products_count' => $this->whenCounted('products'),
            // These three come from aliased withCount()/withSum() clauses on the
            // supplier report query. `isset()` is safe under
            // preventAccessingMissingAttributes (Eloquent catches the miss);
            // reading the attribute directly would not be.
            'linked_products_count' => $this->whenCounted('linked_products'),
            'batches_count' => $this->whenCounted('batches'),
            'units_supplied' => $this->when(
                isset($this->units_supplied),
                fn (): int => (int) $this->units_supplied
            ),
            // Present only when the supplier is loaded through a product's
            // `suppliers` relationship.
            'link' => $this->whenPivotLoaded('supplier_product', fn (): array => [
                'supplier_sku' => $this->pivot->supplier_sku,
                'lead_time_days' => $this->pivot->lead_time_days,
                'minimum_order_quantity' => $this->pivot->minimum_order_quantity,
                'is_preferred' => (bool) $this->pivot->is_preferred,
            ]),
            'products' => ProductSummaryResource::collection($this->whenLoaded('products')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
