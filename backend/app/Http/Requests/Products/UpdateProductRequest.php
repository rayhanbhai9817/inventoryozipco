<?php

declare(strict_types=1);

namespace App\Http\Requests\Products;

use App\Enums\ProductUnit;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class UpdateProductRequest extends FormRequest
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
        $productId = $this->route('product')?->id;

        return [
            'sku' => [
                'sometimes',
                'required',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9._\-\/]+$/',
                Rule::unique('products', 'sku')
                    ->where('business_id', $businessId)
                    ->whereNull('deleted_at')
                    ->ignore($productId),
            ],
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')->where('business_id', $businessId)->whereNull('deleted_at'),
            ],
            'unit' => ['sometimes', 'required', Rule::in(ProductUnit::values())],
            'minimum_stock_level' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'reorder_quantity' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'is_active' => ['sometimes', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'remove_image' => ['sometimes', 'boolean'],
            // NOTE: there is intentionally no `quantity_on_hand` rule. Quantity
            // can only change through a stock movement, never through an edit.
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'sku.unique' => 'Another product in your business already uses this SKU.',
            'category_id.exists' => 'That category does not belong to your business.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('sku')) {
            $this->merge(['sku' => Str::upper(trim((string) $this->input('sku')))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function productAttributes(): array
    {
        return collect($this->safe()->except(['image', 'remove_image']))->all();
    }
}
