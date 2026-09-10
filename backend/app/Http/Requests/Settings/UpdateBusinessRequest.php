<?php

declare(strict_types=1);

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

final class UpdateBusinessRequest extends FormRequest
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
        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:160'],
            'legal_name' => ['nullable', 'string', 'max:160'],
            'contact_email' => ['nullable', 'email:rfc', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'website' => ['nullable', 'url', 'max:255'],
            'industry' => ['nullable', 'string', 'max:80'],
            'address_line1' => ['nullable', 'string', 'max:180'],
            'address_line2' => ['nullable', 'string', 'max:180'],
            'city' => ['nullable', 'string', 'max:120'],
            'state' => ['nullable', 'string', 'max:120'],
            'postal_code' => ['nullable', 'string', 'max:32'],
            'country' => ['nullable', 'string', 'size:2', 'alpha'],
            'timezone' => ['sometimes', 'required', 'timezone'],
            'currency' => ['sometimes', 'required', 'string', 'size:3', 'alpha'],
            'default_minimum_stock_level' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,svg', 'max:2048'],
            'settings' => ['sometimes', 'array'],
            'settings.notifications' => ['sometimes', 'array'],
            'settings.notifications.low_stock_enabled' => ['sometimes', 'boolean'],
            'settings.notifications.out_of_stock_enabled' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->filled('currency')) {
            $merge['currency'] = Str::upper(trim((string) $this->input('currency')));
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
    public function businessAttributes(): array
    {
        return collect($this->safe()->except(['logo']))->all();
    }
}
