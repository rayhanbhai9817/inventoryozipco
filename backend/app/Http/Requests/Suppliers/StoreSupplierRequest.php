<?php

declare(strict_types=1);

namespace App\Http\Requests\Suppliers;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class StoreSupplierRequest extends FormRequest
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
        $supplierId = $this->route('supplier')?->id;

        return [
            'name' => ['required', 'string', 'min:2', 'max:180'],
            'code' => [
                'nullable',
                'string',
                'max:64',
                Rule::unique('suppliers', 'code')
                    ->where('business_id', $businessId)
                    ->whereNull('deleted_at')
                    ->ignore($supplierId),
            ],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'website' => ['nullable', 'url', 'max:255'],
            'address_line1' => ['nullable', 'string', 'max:180'],
            'address_line2' => ['nullable', 'string', 'max:180'],
            'city' => ['nullable', 'string', 'max:120'],
            'state' => ['nullable', 'string', 'max:120'],
            'postal_code' => ['nullable', 'string', 'max:32'],
            'country' => ['nullable', 'string', 'size:2', 'alpha'],
            'default_lead_time_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'product_ids' => ['sometimes', 'array', 'max:500'],
            'product_ids.*' => [
                'integer',
                Rule::exists('products', 'id')->where('business_id', $businessId)->whereNull('deleted_at'),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.unique' => 'Another supplier in your business already uses this code.',
            'product_ids.*.exists' => 'One of the selected products does not belong to your business.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->filled('code')) {
            $merge['code'] = Str::upper(trim((string) $this->input('code')));
        }

        if ($this->filled('country')) {
            $merge['country'] = Str::upper(trim((string) $this->input('country')));
        }

        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function supplierAttributes(): array
    {
        return collect($this->safe()->except(['product_ids']))->all();
    }

    /**
     * @return array<int, int>|null null means "leave the links alone"
     */
    public function productIds(): ?array
    {
        if (! $this->has('product_ids')) {
            return null;
        }

        return array_map('intval', (array) $this->input('product_ids', []));
    }
}
