<?php

declare(strict_types=1);

namespace App\Policies\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Shared tenancy check for every policy.
 *
 * The global query scope already makes a cross-tenant record unreachable, so in
 * practice a policy never sees a foreign model. This is the deliberate second
 * layer: if a record is ever loaded by a path that bypassed the scope (a raw
 * query, a future feature, a `withoutGlobalScopes()` call), authorisation still
 * fails closed.
 */
trait ScopedToBusiness
{
    protected function sameBusiness(User $user, Model $model): bool
    {
        $businessId = $model->getAttribute('business_id');

        return $businessId !== null
            && $user->business_id !== null
            && (int) $businessId === (int) $user->business_id;
    }
}
