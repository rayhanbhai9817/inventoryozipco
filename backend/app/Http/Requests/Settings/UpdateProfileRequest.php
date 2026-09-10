<?php

declare(strict_types=1);

namespace App\Http\Requests\Settings;

use App\Enums\NotificationType;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class UpdateProfileRequest extends FormRequest
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
        /** @var User $user */
        $user = $this->user();

        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'email' => [
                'sometimes',
                'required',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->whereNull('deleted_at')->ignore($user->id),
            ],
            'job_title' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'notification_preferences' => ['sometimes', 'array'],
            // Only mutable notification types may be toggled; administrative
            // notices are always delivered.
            'notification_preferences.*' => ['boolean'],
        ];
    }

    /**
     * @return array<int, \Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $preferences = (array) $this->input('notification_preferences', []);
                $mutable = array_map(
                    static fn (NotificationType $type): string => $type->value,
                    array_filter(
                        NotificationType::cases(),
                        static fn (NotificationType $type): bool => $type->isMutable()
                    )
                );

                foreach (array_keys($preferences) as $key) {
                    if (! in_array((string) $key, $mutable, true)) {
                        $validator->errors()->add(
                            "notification_preferences.{$key}",
                            'That notification type cannot be muted.'
                        );
                    }
                }
            },
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function profileAttributes(): array
    {
        return collect($this->safe()->except(['avatar']))->all();
    }
}
