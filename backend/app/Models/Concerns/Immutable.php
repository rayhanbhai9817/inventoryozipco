<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use App\Exceptions\ImmutableRecordException;
use Illuminate\Database\Eloquent\Model;

/**
 * Marks a model as append-only. Inserts succeed; updates and deletes throw.
 *
 * Used by the inventory ledger and the audit log so that history cannot be
 * rewritten — not by a controller, not by a future feature, not from Tinker.
 *
 * @phpstan-require-extends Model
 */
trait Immutable
{
    public static function bootImmutable(): void
    {
        static::updating(function (self $model): void {
            throw ImmutableRecordException::forUpdate($model::class);
        });

        static::deleting(function (self $model): void {
            throw ImmutableRecordException::forDelete($model::class);
        });
    }
}
