<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Business;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Business
 */
final class BusinessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'legal_name' => $this->legal_name,
            'contact_email' => $this->contact_email,
            'phone' => $this->phone,
            'website' => $this->website,
            'industry' => $this->industry,
            'address' => [
                'line1' => $this->address_line1,
                'line2' => $this->address_line2,
                'city' => $this->city,
                'state' => $this->state,
                'postal_code' => $this->postal_code,
                'country' => $this->country,
            ],
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'logo_url' => $this->logo_path !== null ? asset('storage/'.$this->logo_path) : null,
            'default_minimum_stock_level' => $this->default_minimum_stock_level,
            'settings' => $this->settings ?? [],
            'users_count' => $this->whenCounted('users'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
