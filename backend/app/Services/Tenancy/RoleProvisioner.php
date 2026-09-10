<?php

declare(strict_types=1);

namespace App\Services\Tenancy;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\Business;
use App\Models\PermissionDefinition;
use App\Models\RoleDefinition;
use App\Support\TenantContext;

/**
 * Creates (or repairs) a business's role rows and their default permission
 * grants.
 *
 * Separate from registration so it can also be run for existing businesses by
 * the `tenants:sync-roles` command after new permissions ship.
 */
final class RoleProvisioner
{
    public function provision(Business $business): void
    {
        TenantContext::unscoped(function () use ($business): void {
            $this->syncPermissionCatalogue();

            $permissionIds = PermissionDefinition::query()->pluck('id', 'key');

            foreach (Role::cases() as $role) {
                /** @var RoleDefinition $definition */
                $definition = RoleDefinition::query()->updateOrCreate(
                    ['business_id' => $business->id, 'key' => $role->value],
                    ['name' => $role->label(), 'description' => $role->description(), 'is_system' => true],
                );

                // Owners are authorised unconditionally in code, so their row
                // exists for completeness but carries no editable matrix.
                if ($role === Role::Owner) {
                    continue;
                }

                // Only create the matrix the first time. Re-provisioning an
                // existing business must not wipe an Owner's customisations.
                if ($definition->wasRecentlyCreated || $definition->permissions()->doesntExist()) {
                    $ids = collect($role->defaultPermissions())
                        ->map(static fn (string $key) => $permissionIds[$key] ?? null)
                        ->filter()
                        ->values()
                        ->all();

                    $definition->permissions()->sync($ids);
                }
            }
        });
    }

    /**
     * Make sure the global permission catalogue matches the Permission enum.
     */
    public function syncPermissionCatalogue(): void
    {
        foreach (Permission::cases() as $permission) {
            PermissionDefinition::query()->updateOrCreate(
                ['key' => $permission->value],
                [
                    'name' => $permission->label(),
                    'group' => $permission->group(),
                    'owner_only' => $permission->isOwnerOnly(),
                ],
            );
        }
    }
}
