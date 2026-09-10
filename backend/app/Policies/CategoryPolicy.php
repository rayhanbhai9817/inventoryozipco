<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Category;
use App\Models\User;
use App\Policies\Concerns\ScopedToBusiness;

final class CategoryPolicy
{
    use ScopedToBusiness;

    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::CategoriesView);
    }

    public function view(User $user, Category $category): bool
    {
        return $this->sameBusiness($user, $category) && $user->hasPermission(Permission::CategoriesView);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::CategoriesManage);
    }

    public function update(User $user, Category $category): bool
    {
        return $this->sameBusiness($user, $category) && $user->hasPermission(Permission::CategoriesManage);
    }

    /**
     * A category holding products can be archived but not deleted, so product
     * rows never end up pointing at a category that no longer exists.
     */
    public function delete(User $user, Category $category): bool
    {
        return $this->sameBusiness($user, $category)
            && $user->hasPermission(Permission::CategoriesManage)
            && ! $category->products()->exists();
    }
}
