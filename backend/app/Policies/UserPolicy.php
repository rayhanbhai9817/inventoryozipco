<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\User;
use App\Policies\Concerns\ScopedToBusiness;

/**
 * User administration rules.
 *
 * Beyond the permission checks, these encode three safety rules that exist to
 * stop a business locking itself out or escalating privileges:
 *
 *  1. Nobody may change their own role or deactivate themselves.
 *  2. A user may only assign roles at or below their own
 *     ({@see Role::assignableRoles()}).
 *  3. The last active Owner cannot be deactivated, demoted or deleted.
 */
final class UserPolicy
{
    use ScopedToBusiness;

    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::UsersView);
    }

    public function view(User $user, User $target): bool
    {
        if ($user->id === $target->id) {
            return true;
        }

        return $this->sameBusinessUser($user, $target) && $user->hasPermission(Permission::UsersView);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::UsersManage);
    }

    public function update(User $user, User $target): bool
    {
        return $this->sameBusinessUser($user, $target) && $user->hasPermission(Permission::UsersManage);
    }

    /**
     * Changing a role is stricter than editing a profile: the actor must be able
     * to assign the target role, must not be editing themselves, and must not be
     * demoting the last Owner.
     */
    public function assignRole(User $user, User $target, Role $role): bool
    {
        if (! $this->update($user, $target)) {
            return false;
        }

        if ($user->id === $target->id) {
            return false;
        }

        if (! in_array($role, $user->role->assignableRoles(), true)) {
            return false;
        }

        if ($target->role === Role::Owner && $role !== Role::Owner && $this->isLastActiveOwner($target)) {
            return false;
        }

        return true;
    }

    public function deactivate(User $user, User $target): bool
    {
        if (! $this->update($user, $target)) {
            return false;
        }

        if ($user->id === $target->id) {
            return false;
        }

        return ! ($target->role === Role::Owner && $this->isLastActiveOwner($target));
    }

    public function delete(User $user, User $target): bool
    {
        return $this->deactivate($user, $target);
    }

    /**
     * Editing the per-user permission overrides.
     */
    public function managePermissions(User $user, User $target): bool
    {
        return $this->sameBusinessUser($user, $target)
            && $user->hasPermission(Permission::UsersManage)
            && $target->role !== Role::Owner
            && $user->id !== $target->id;
    }

    private function sameBusinessUser(User $user, User $target): bool
    {
        return $user->business_id !== null && $user->business_id === $target->business_id;
    }

    private function isLastActiveOwner(User $target): bool
    {
        return User::query()
            ->where('business_id', $target->business_id)
            ->where('role', Role::Owner->value)
            ->where('is_active', true)
            ->whereKeyNot($target->id)
            ->doesntExist();
    }
}
