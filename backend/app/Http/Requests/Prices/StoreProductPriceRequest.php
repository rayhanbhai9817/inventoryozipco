<?php

declare(strict_types=1);

namespace App\Http\Requests\Prices;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class StoreProductPriceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $businessId = TenantContext::businessId();

        return [
            'product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')->where('business_id', $businessId)->whereNull('deleted_at'),
            ],
            'reference_price' => ['required', 'numeric', 'min:0', 'max:99999999.9999'],
            'currency' => ['nullable', 'string', 'size:3', 'alpha'],
            'effective_from' => ['nullable', 'date'],
            'source' => ['nullable', 'string', 'max:128'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            // NOTE: there is deliberately no quantity field anywhere in this
            // request. Reference pricing cannot touch inventory.
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_id.exists' => 'That product does not belong to your business.',
            'reference_price.min' => 'A reference price cannot be negative.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('currency')) {
            $this->merge(['currency' => Str::upper(trim((string) $this->input('currency')))]);
        }
    }
}
