<?php

declare(strict_types=1);

namespace App\Http\Requests\Users;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

final class StoreUserRequest extends FormRequest
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
        /** @var User $actor */
        $actor = $this->user();

        $assignable = array_map(
            static fn (Role $role): string => $role->value,
            $actor->role->assignableRoles()
        );

        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            // Email is globally unique: a person signs in with one address and
            // belongs to exactly one business.
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'role' => ['required', Rule::in($assignable)],
            'job_title' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(10)->letters()->mixedCase()->numbers(),
            ],
            'must_change_password' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => [Rule::in($this->grantablePermissionKeys())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'An account already exists for this email address.',
            'role.in' => 'You cannot assign that role.',
            'permissions.*.in' => 'One of the selected permissions cannot be granted.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }
    }

    /**
     * Owner-only permissions can never be granted to another role, so they are
     * excluded from the accepted set rather than silently dropped later.
     *
     * @return array<int, string>
     */
    private function grantablePermissionKeys(): array
    {
        return array_values(array_map(
            static fn (Permission $permission): string => $permission->value,
            array_filter(
                Permission::cases(),
                static fn (Permission $permission): bool => ! $permission->isOwnerOnly()
            )
        ));
    }
}
