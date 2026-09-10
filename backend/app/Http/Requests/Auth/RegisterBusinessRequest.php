<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Business (tenant) registration.
 *
 * Only the fields needed to create a business and its first Owner. Everything
 * else — address, logo, currency detail — is set later in Settings, so signup
 * stays a short form.
 */
final class RegisterBusinessRequest extends FormRequest
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
            'business_name' => ['required', 'string', 'min:2', 'max:160'],
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email:rfc', 'max:255', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(10)->letters()->mixedCase()->numbers()->uncompromised(),
            ],
            'industry' => ['nullable', 'string', 'max:80'],
            'timezone' => ['nullable', 'string', 'timezone'],
            'currency' => ['nullable', 'string', 'size:3', 'alpha'],
            'terms_accepted' => ['accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'An account already exists for this email address. Try signing in instead.',
            'terms_accepted.accepted' => 'Please accept the terms of service to continue.',
            'password.confirmed' => 'The two passwords do not match.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'business_name' => 'business name',
            'name' => 'your name',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'email' => $this->has('email') ? Str::lower(trim((string) $this->input('email'))) : null,
            'currency' => $this->has('currency') ? Str::upper(trim((string) $this->input('currency'))) : null,
        ], static fn ($value): bool => $value !== null));
    }
}
