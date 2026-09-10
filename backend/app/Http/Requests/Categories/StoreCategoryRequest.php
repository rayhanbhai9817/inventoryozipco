<?php

declare(strict_types=1);

namespace App\Http\Requests\Categories;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreCategoryRequest extends FormRequest
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
        $categoryId = $this->route('category')?->id;

        return [
            'name' => [
                'required',
                'string',
                'min:2',
                'max:120',
                Rule::unique('categories', 'name')
                    ->where('business_id', $businessId)
                    ->whereNull('deleted_at')
                    ->ignore($categoryId),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            // Hex colour used for the category chip in the UI.
            'color' => ['nullable', 'string', 'regex:/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'You already have a category with this name.',
            'color.regex' => 'Use a hex colour such as #1E989F.',
        ];
    }
}
