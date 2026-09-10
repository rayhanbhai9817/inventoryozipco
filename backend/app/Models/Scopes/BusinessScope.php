<?php

declare(strict_types=1);

namespace App\Models\Scopes;

use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Global scope that confines every query on a tenant-owned model to the
 * business in the current {@see TenantContext}.
 *
 * This is the backbone of tenant isolation: it applies to reads, relationship
 * loads, aggregates and sub-queries alike, so a missing `where business_id`
 * in a controller cannot leak another tenant's rows. Controllers never pass a
 * tenant id from the request — the context is derived from the authenticated
 * user only.
 */
final class BusinessScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $businessId = TenantContext::businessId();

        if ($businessId === null) {
            // No resolved tenant (console commands, tests, unauthenticated
            // requests). Fail closed rather than returning every tenant's rows.
            if (TenantContext::isUnscoped()) {
                return;
            }

            $builder->whereRaw('1 = 0');

            return;
        }

        $builder->where($model->qualifyColumn('business_id'), $businessId);
    }
}
