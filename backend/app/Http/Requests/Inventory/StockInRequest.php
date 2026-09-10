<?php

declare(strict_types=1);

namespace App\Http\Requests\Inventory;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StockInRequest extends FormRequest
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
                // Tenant-scoped existence: a product id from another business
                // fails validation before it ever reaches the service.
                Rule::exists('products', 'id')->where('business_id', $businessId)->whereNull('deleted_at'),
            ],
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'supplier_id' => [
                'nullable',
                'integer',
                Rule::exists('suppliers', 'id')->where('business_id', $businessId)->whereNull('deleted_at'),
            ],
            'batch_number' => [
                'nullable',
                'string',
                'max:64',
                Rule::unique('stock_batches', 'batch_number')->where('business_id', $businessId),
            ],
            'reference' => ['nullable', 'string', 'max:128'],
            // Reference information only — never used for inventory valuation.
            'unit_cost' => ['nullable', 'numeric', 'min:0', 'max:99999999.9999'],
            'received_at' => ['nullable', 'date', 'before_or_equal:now'],
            'expires_at' => ['nullable', 'date', 'after:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_id.exists' => 'That product does not belong to your business.',
            'supplier_id.exists' => 'That supplier does not belong to your business.',
            'batch_number.unique' => 'That batch number has already been used.',
            'quantity.min' => 'Received quantity must be at least 1.',
            'received_at.before_or_equal' => 'A receipt cannot be dated in the future.',
        ];
    }
}
