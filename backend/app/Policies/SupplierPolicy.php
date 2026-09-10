<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Supplier;
use App\Models\User;
use App\Policies\Concerns\ScopedToBusiness;

final class SupplierPolicy
{
    use ScopedToBusiness;

    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::SuppliersView);
    }

    public function view(User $user, Supplier $supplier): bool
    {
        return $this->sameBusiness($user, $supplier) && $user->hasPermission(Permission::SuppliersView);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::SuppliersManage);
    }

    public function update(User $user, Supplier $supplier): bool
    {
        return $this->sameBusiness($user, $supplier) && $user->hasPermission(Permission::SuppliersManage);
    }

    /**
     * Suppliers attached to received stock are never deleted — the batches they
     * supplied must keep pointing at them. Deactivate instead.
     */
    public function delete(User $user, Supplier $supplier): bool
    {
        return $this->sameBusiness($user, $supplier)
            && $user->hasPermission(Permission::SuppliersManage)
            && ! $supplier->stockBatches()->exists();
    }
}
