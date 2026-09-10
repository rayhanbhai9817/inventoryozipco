<?php

declare(strict_types=1);

namespace App\Http\Requests\Products;

use App\Enums\ProductUnit;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class StoreProductRequest extends FormRequest
{
    /**
     * Authorisation lives in ProductPolicy; the controller calls it explicitly so
     * the failure is a 403 with a useful message.
     */
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
            'sku' => [
                'required',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9._\-\/]+$/',
                // Uniqueness is scoped to the tenant, so two businesses may each
                // use "SKU-001".
                Rule::unique('products', 'sku')
                    ->where('business_id', $businessId)
                    ->whereNull('deleted_at'),
            ],
            'name' => ['required', 'string', 'min:2', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')->where('business_id', $businessId)->whereNull('deleted_at'),
            ],
            'unit' => ['required', Rule::in(ProductUnit::values())],
            'minimum_stock_level' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'reorder_quantity' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'is_active' => ['sometimes', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'supplier_ids' => ['sometimes', 'array', 'max:50'],
            'supplier_ids.*' => [
                'integer',
                Rule::exists('suppliers', 'id')->where('business_id', $businessId)->whereNull('deleted_at'),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'sku.unique' => 'Another product in your business already uses this SKU.',
            'sku.regex' => 'A SKU may contain letters, numbers, dots, dashes, underscores and slashes.',
            'category_id.exists' => 'That category does not belong to your business.',
            'supplier_ids.*.exists' => 'One of the selected suppliers does not belong to your business.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('sku')) {
            $this->merge(['sku' => Str::upper(trim((string) $this->input('sku')))]);
        }
    }

    /**
     * Attributes safe to pass to the model, with the image and supplier links
     * removed (they are handled separately by the controller).
     *
     * @return array<string, mixed>
     */
    public function productAttributes(): array
    {
        return array_merge(
            collect($this->safe()->except(['image', 'supplier_ids']))->all(),
            ['minimum_stock_level' => (int) ($this->input('minimum_stock_level') ?? 0)],
        );
    }

    /**
     * @return array<int, int>
     */
    public function supplierIds(): array
    {
        return array_map('intval', (array) $this->input('supplier_ids', []));
    }
}
