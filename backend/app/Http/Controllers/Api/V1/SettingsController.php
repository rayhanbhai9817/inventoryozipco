<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\AuditAction;
use App\Enums\Permission;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateBusinessRequest;
use App\Http\Requests\Settings\UpdatePasswordRequest;
use App\Http\Requests\Settings\UpdateProfileRequest;
use App\Http\Resources\BusinessResource;
use App\Http\Resources\UserResource;
use App\Models\PermissionDefinition;
use App\Models\RoleDefinition;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class SettingsController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * GET /api/v1/settings/business
     */
    public function business(Request $request): BusinessResource
    {
        $business = $request->user()->business;
        $this->authorize('view', $business);

        return new BusinessResource($business->loadCount('users'));
    }

    /**
     * PATCH /api/v1/settings/business
     */
    public function updateBusiness(UpdateBusinessRequest $request): BusinessResource
    {
        $business = $request->user()->business;
        $this->authorize('update', $business);

        $attributes = $request->businessAttributes();

        if ($request->hasFile('logo')) {
            $attributes['logo_path'] = $request->file('logo')->store('logos', 'public');
        }

        $business->fill($attributes);

        if ($business->isDirty()) {
            $business->save();

            $this->audit->logModelChange(
                action: AuditAction::BusinessUpdated,
                model: $business,
                description: sprintf('Updated business settings for %s', $business->name),
            );
        }

        return new BusinessResource($business->loadCount('users'));
    }

    /**
     * GET /api/v1/settings/profile
     */
    public function profile(Request $request): UserResource
    {
        return (new UserResource($request->user()->load('business')))->withPermissions();
    }

    /**
     * PATCH /api/v1/settings/profile
     *
     * A user always controls their own profile. Note that `role` is not an
     * accepted field here — nobody promotes themselves.
     */
    public function updateProfile(UpdateProfileRequest $request): UserResource
    {
        $user = $request->user();
        $attributes = $request->profileAttributes();

        if ($request->hasFile('avatar')) {
            $attributes['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }

        $user->fill($attributes);

        if ($user->isDirty()) {
            $user->save();

            $this->audit->logModelChange(
                action: AuditAction::UserUpdated,
                model: $user,
                description: 'Updated own profile',
            );
        }

        return (new UserResource($user->fresh('business')))->withPermissions();
    }

    /**
     * PUT /api/v1/settings/password
     *
     * Changing the password revokes every other token, so a session that may
     * have been the reason for the change stops working.
     */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();

        $user->forceFill([
            'password' => $request->string('password')->value(),
            'must_change_password' => false,
        ])->save();

        $user->tokens()
            ->when(
                $currentToken !== null && isset($currentToken->id),
                fn ($query) => $query->whereKeyNot($currentToken->id)
            )
            ->delete();

        $this->audit->log(
            action: AuditAction::PasswordChanged,
            description: sprintf('%s changed their password', $user->name),
            auditable: $user,
        );

        return new JsonResponse(['message' => 'Password updated. Other devices have been signed out.']);
    }

    /**
     * GET /api/v1/settings/roles
     *
     * The editable permission matrix. Owner is returned as a fixed row because
     * owners are authorised unconditionally in code.
     */
    public function roles(Request $request): JsonResponse
    {
        $business = $request->user()->business;
        $this->authorize('manageRoles', $business);

        $definitions = RoleDefinition::query()->with('permissions:id,key')->get()->keyBy('key');

        $roles = [];

        foreach (Role::cases() as $role) {
            $definition = $definitions->get($role->value);

            $roles[] = [
                'key' => $role->value,
                'label' => $role->label(),
                'description' => $role->description(),
                'is_editable' => $role !== Role::Owner,
                'permissions' => $role === Role::Owner
                    ? Permission::keys()
                    : ($definition?->permissions->pluck('key')->all() ?? $role->defaultPermissions()),
            ];
        }

        return new JsonResponse([
            'data' => [
                'roles' => $roles,
                'catalogue' => $this->permissionCatalogue(),
            ],
        ]);
    }

    /**
     * PUT /api/v1/settings/roles/{role}
     *
     * Replaces one role's permission set. Owner-only permissions are rejected,
     * and the Owner role itself cannot be edited.
     */
    public function updateRole(Request $request, string $role): JsonResponse
    {
        $business = $request->user()->business;
        $this->authorize('manageRoles', $business);

        $roleEnum = Role::tryFrom($role);

        if ($roleEnum === null || $roleEnum === Role::Owner) {
            return new JsonResponse([
                'message' => 'That role cannot be edited. Owners always hold every permission.',
            ], 422);
        }

        $grantable = array_values(array_map(
            static fn (Permission $p): string => $p->value,
            array_filter(Permission::cases(), static fn (Permission $p): bool => ! $p->isOwnerOnly())
        ));

        $validated = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => [Rule::in($grantable)],
        ], [
            'permissions.*.in' => 'One of the selected permissions cannot be granted to this role.',
        ]);

        DB::transaction(function () use ($request, $roleEnum, $validated): void {
            /** @var RoleDefinition $definition */
            $definition = RoleDefinition::query()->firstOrCreate(
                ['business_id' => $request->user()->business_id, 'key' => $roleEnum->value],
                ['name' => $roleEnum->label(), 'description' => $roleEnum->description(), 'is_system' => true],
            );

            $previous = $definition->permissions()->pluck('key')->all();

            $ids = PermissionDefinition::query()
                ->whereIn('key', $validated['permissions'])
                ->pluck('id')
                ->all();

            $definition->permissions()->sync($ids);

            $this->audit->log(
                action: AuditAction::RolePermissionsChanged,
                description: sprintf('Updated permissions for the %s role', $roleEnum->label()),
                auditable: $definition,
                oldValues: ['permissions' => $previous],
                newValues: ['permissions' => $validated['permissions']],
            );
        });

        return new JsonResponse(['message' => sprintf('%s permissions updated.', $roleEnum->label())]);
    }

    /**
     * GET /api/v1/settings/permissions — the full catalogue, grouped.
     */
    public function permissions(Request $request): JsonResponse
    {
        $this->authorize('view', $request->user()->business);

        return new JsonResponse(['data' => $this->permissionCatalogue()]);
    }

    /**
     * @return array<int, array{group: string, permissions: array<int, array{key: string, label: string, owner_only: bool}>}>
     */
    private function permissionCatalogue(): array
    {
        $grouped = [];

        foreach (Permission::cases() as $permission) {
            $grouped[$permission->group()][] = [
                'key' => $permission->value,
                'label' => $permission->label(),
                'owner_only' => $permission->isOwnerOnly(),
            ];
        }

        $catalogue = [];

        foreach ($grouped as $group => $permissions) {
            $catalogue[] = ['group' => $group, 'permissions' => $permissions];
        }

        return $catalogue;
    }
}
