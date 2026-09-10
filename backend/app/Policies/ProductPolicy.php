<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Product;
use App\Models\User;
use App\Policies\Concerns\ScopedToBusiness;

final class ProductPolicy
{
    use ScopedToBusiness;

    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::ProductsView);
    }

    public function view(User $user, Product $product): bool
    {
        return $this->sameBusiness($user, $product) && $user->hasPermission(Permission::ProductsView);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::ProductsManage);
    }

    public function update(User $user, Product $product): bool
    {
        return $this->sameBusiness($user, $product) && $user->hasPermission(Permission::ProductsManage);
    }

    /**
     * Archiving is the normal way to retire a product, because its inventory
     * history must survive.
     */
    public function archive(User $user, Product $product): bool
    {
        return $this->sameBusiness($user, $product) && $user->hasPermission(Permission::ProductsDelete);
    }

    public function restore(User $user, Product $product): bool
    {
        return $this->archive($user, $product);
    }

    /**
     * Hard deletion is reserved for products that have never moved — anything
     * with ledger history may only be archived, so the trail stays intact.
     */
    public function delete(User $user, Product $product): bool
    {
        return $this->sameBusiness($user, $product)
            && $user->hasPermission(Permission::ProductsDelete)
            && ! $product->stockMovements()->exists();
    }

    public function manageSuppliers(User $user, Product $product): bool
    {
        return $this->sameBusiness($user, $product)
            && $user->hasAnyPermission(Permission::ProductsManage, Permission::SuppliersManage);
    }
}
