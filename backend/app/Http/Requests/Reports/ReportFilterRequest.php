<?php

declare(strict_types=1);

namespace App\Http\Requests\Reports;

use App\Enums\MovementType;
use App\Enums\StockStatus;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Shared filter validation for every report and list endpoint.
 *
 * Validating sort keys and page sizes here (rather than trusting query strings)
 * keeps arbitrary column names out of SQL and caps the work a single request can
 * ask the database to do.
 */
final class ReportFilterRequest extends FormRequest
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
            'search' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'product_id' => [
                'nullable',
                'integer',
                Rule::exists('products', 'id')->where('business_id', $businessId),
            ],
            'supplier_id' => [
                'nullable',
                'integer',
                Rule::exists('suppliers', 'id')->where('business_id', $businessId),
            ],
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')->where('business_id', $businessId),
            ],
            'type' => ['nullable', Rule::in(MovementType::values())],
            'stock_status' => ['nullable', Rule::in([
                StockStatus::InStock->value,
                StockStatus::LowStock->value,
                StockStatus::OutOfStock->value,
            ])],
            'include_archived' => ['nullable', 'boolean'],
            'include_inactive' => ['nullable', 'boolean'],
            'include_depleted' => ['nullable', 'boolean'],
            'sort' => ['nullable', 'string', 'max:40'],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date_to.after_or_equal' => 'The end date must be on or after the start date.',
            'product_id.exists' => 'That product does not belong to your business.',
            'supplier_id.exists' => 'That supplier does not belong to your business.',
            'category_id.exists' => 'That category does not belong to your business.',
        ];
    }

    /**
     * Only the keys that were actually supplied, so services can use
     * `isset()` to decide whether a filter applies.
     *
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        return array_filter(
            $this->validated(),
            static fn ($value): bool => $value !== null && $value !== ''
        );
    }

    public function movementType(): ?MovementType
    {
        $type = $this->validated()['type'] ?? null;

        return $type !== null ? MovementType::from((string) $type) : null;
    }
}
