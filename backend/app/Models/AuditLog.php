<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AuditAction;
use App\Models\Concerns\Immutable;
use App\Models\Scopes\BusinessScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An immutable audit record.
 *
 * Tenant scoping is applied through {@see BusinessScope} like every other
 * tenant-owned model, but the BelongsToBusiness trait is not used: audit rows
 * must also be writable for pre-authentication events (a failed login against an
 * address that belongs to no known business), where there is no tenant context
 * to stamp from.
 *
 * @property int|null $business_id
 * @property AuditAction $action
 * @property string $description
 * @property array<string, mixed>|null $old_values
 * @property array<string, mixed>|null $new_values
 */
class AuditLog extends Model
{
    use Immutable;

    public const UPDATED_AT = null;

    protected $fillable = [
        'business_id',
        'user_id',
        'user_name',
        'action',
        'category',
        'auditable_type',
        'auditable_id',
        'description',
        'old_values',
        'new_values',
        'meta',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'action' => AuditAction::class,
            'old_values' => 'array',
            'new_values' => 'array',
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new BusinessScope);
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Write a row outside tenant scoping. Used by the audit logger only, which
     * already decides the correct `business_id` (including null).
     *
     * @param  array<string, mixed>  $attributes
     */
    public static function record(array $attributes): self
    {
        $log = new self;
        $log->forceFill($attributes);
        $log->saveQuietly();

        return $log;
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($term)).'%';

        return $query->where(function (Builder $inner) use ($like): void {
            $inner->where('description', 'like', $like)
                ->orWhere('user_name', 'like', $like)
                ->orWhere('action', 'like', $like);
        });
    }

    public function scopeBetween(Builder $query, ?string $from, ?string $to): Builder
    {
        return $query
            ->when($from, fn (Builder $q, string $value): Builder => $q->where('created_at', '>=', $value.' 00:00:00'))
            ->when($to, fn (Builder $q, string $value): Builder => $q->where('created_at', '<=', $value.' 23:59:59'));
    }
}
