<?php

declare(strict_types=1);

namespace App\Http\Requests\Inventory;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Stock OUT input.
 *
 * There is no batch selector: which batches are consumed is FIFO, decided by the
 * backend. Availability is NOT validated here — it is checked inside the
 * service's transaction under a lock, because a check at validation time would
 * be stale by the time the write happens.
 */
final class StockOutRequest extends FormRequest
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
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'reference' => ['nullable', 'string', 'max:128'],
            'reason' => ['nullable', 'string', 'max:128'],
            'occurred_at' => ['nullable', 'date', 'before_or_equal:now'],
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
            'quantity.min' => 'Issued quantity must be at least 1.',
            'occurred_at.before_or_equal' => 'A withdrawal cannot be dated in the future.',
        ];
    }
}
