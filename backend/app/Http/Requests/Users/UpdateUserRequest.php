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

final class UpdateUserRequest extends FormRequest
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
        $targetId = $this->route('user')?->id;

        $assignable = array_map(
            static fn (Role $role): string => $role->value,
            $actor->role->assignableRoles()
        );

        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'email' => [
                'sometimes',
                'required',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->whereNull('deleted_at')->ignore($targetId),
            ],
            'role' => ['sometimes', 'required', Rule::in($assignable)],
            'job_title' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'is_active' => ['sometimes', 'boolean'],
            // Optional: an owner resetting a user's password.
            'password' => ['sometimes', 'nullable', 'string', 'confirmed', Password::min(10)->letters()->mixedCase()->numbers()],
            'must_change_password' => ['sometimes', 'boolean'],
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
            'role.in' => 'You cannot assign that role.',
            'email.unique' => 'An account already exists for this email address.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }
    }

    /**
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
