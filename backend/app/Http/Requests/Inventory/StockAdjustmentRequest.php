<?php

declare(strict_types=1);

namespace App\Http\Requests\Inventory;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StockAdjustmentRequest extends FormRequest
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
            // Signed. Positive opens a new batch; negative consumes FIFO.
            'quantity_delta' => ['required', 'integer', 'not_in:0', 'min:-1000000000', 'max:1000000000'],
            // A reason is mandatory: an unexplained adjustment is the one thing a
            // stock audit can never reconstruct afterwards.
            'reason' => ['required', 'string', 'min:3', 'max:128'],
            'reference' => ['nullable', 'string', 'max:128'],
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
            'quantity_delta.not_in' => 'An adjustment must change the quantity.',
            'reason.required' => 'Please record why the quantity is being adjusted.',
        ];
    }
}
