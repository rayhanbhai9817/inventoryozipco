<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\Permission;
use App\Models\ProductPrice;
use App\Models\User;
use App\Policies\Concerns\ScopedToBusiness;

final class ProductPricePolicy
{
    use ScopedToBusiness;

    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::PricesView);
    }

    public function view(User $user, ProductPrice $price): bool
    {
        return $this->sameBusiness($user, $price) && $user->hasPermission(Permission::PricesView);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::PricesManage);
    }

    public function update(User $user, ProductPrice $price): bool
    {
        return $this->sameBusiness($user, $price) && $user->hasPermission(Permission::PricesManage);
    }

    public function delete(User $user, ProductPrice $price): bool
    {
        return $this->update($user, $price);
    }
}
