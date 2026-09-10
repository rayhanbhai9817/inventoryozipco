<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class UserResource extends JsonResource
{
    /**
     * Whether to include the effective permission list. Only done for the
     * authenticated user's own `/auth/me` payload, which the frontend uses to
     * decide what to render.
     */
    private bool $withPermissions = false;

    public function withPermissions(bool $include = true): self
    {
        $this->withPermissions = $include;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'initials' => $this->initials(),
            'email' => $this->email,
            'role' => [
                'value' => $this->role->value,
                'label' => $this->role->label(),
                'description' => $this->role->description(),
            ],
            'job_title' => $this->job_title,
            'phone' => $this->phone,
            'avatar_url' => $this->avatar_path !== null ? asset('storage/'.$this->avatar_path) : null,
            'is_active' => $this->is_active,
            'is_owner' => $this->isOwner(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'invited_at' => $this->invited_at?->toIso8601String(),
            'must_change_password' => $this->must_change_password,
            'notification_preferences' => $this->notification_preferences ?? [],
            'business' => new BusinessResource($this->whenLoaded('business')),
            'permissions' => $this->when($this->withPermissions, fn (): array => $this->effectivePermissions()),
            'assignable_roles' => $this->when($this->withPermissions, fn (): array => array_map(
                static fn ($role): array => ['value' => $role->value, 'label' => $role->label()],
                $this->role->assignableRoles()
            )),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
