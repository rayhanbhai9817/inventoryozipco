<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Product;
use App\Models\User;
use App\Policies\Concerns\ScopedToBusiness;

/**
 * Authorises inventory operations. Registered as a gate-style policy rather than
 * being bound to a model, because "record a stock movement" is an action on the
 * inventory as a whole, with the product as its subject.
 */
final class InventoryPolicy
{
    use ScopedToBusiness;

    public function view(User $user): bool
    {
        return $user->hasPermission(Permission::InventoryView);
    }

    public function stockIn(User $user, Product $product): bool
    {
        return $this->canMove($user, $product, Permission::StockInCreate);
    }

    public function stockOut(User $user, Product $product): bool
    {
        return $this->canMove($user, $product, Permission::StockOutCreate);
    }

    public function adjust(User $user, Product $product): bool
    {
        return $this->canMove($user, $product, Permission::InventoryAdjust);
    }

    /**
     * An archived product is read-only: its history stays visible but no new
     * movement may be recorded against it.
     */
    private function canMove(User $user, Product $product, Permission $permission): bool
    {
        return $this->sameBusiness($user, $product)
            && $user->hasPermission($permission)
            && ! $product->isArchived();
    }
}
