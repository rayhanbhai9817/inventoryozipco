<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use App\Models\Business;
use App\Models\Scopes\BusinessScope;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Applied to every tenant-owned model.
 *
 * Does two things:
 *  1. Registers {@see BusinessScope} so reads can never cross tenants.
 *  2. Stamps `business_id` on create from the current tenant context, so
 *     writes can never be mis-attributed either.
 *
 * @phpstan-require-extends Model
 */
trait BelongsToBusiness
{
    public static function bootBelongsToBusiness(): void
    {
        static::addGlobalScope(new BusinessScope);

        static::creating(function (self $model): void {
            if ($model->getAttribute('business_id') === null) {
                $model->setAttribute('business_id', TenantContext::businessId());
            }
        });
    }

    public function business(): BelongsTo
    {
        /** @var Model $this */
        return $this->belongsTo(Business::class);
    }

    /**
     * Escape hatch for platform-level queries. Intentionally verbose so that it
     * stands out in review wherever it is used.
     */
    public function scopeAcrossAllBusinesses(Builder $query): Builder
    {
        return $query->withoutGlobalScope(BusinessScope::class);
    }
}
