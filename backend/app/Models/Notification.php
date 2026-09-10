<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\NotificationSeverity;
use App\Enums\NotificationType;
use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * An in-app notification.
 *
 * Named `Notification` in the app namespace; it is a first-class domain record
 * rather than a Laravel broadcast notification, which keeps the history
 * queryable and reportable.
 *
 * @property int $id
 * @property int|null $user_id null = addressed to the whole business
 * @property NotificationType $type
 * @property NotificationSeverity $severity
 * @property Carbon|null $read_at
 */
class Notification extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'user_id',
        'type',
        'severity',
        'title',
        'body',
        'resource_type',
        'resource_id',
        'action_url',
        'data',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => NotificationType::class,
            'severity' => NotificationSeverity::class,
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Per-user read receipts, used for business-wide notifications where
     * `user_id` is null.
     */
    public function readers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'notification_reads', 'notification_id', 'user_id')
            ->withPivot('read_at');
    }

    /**
     * Notifications visible to a given user: their own, plus business-wide ones.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $inner) use ($user): void {
            $inner->whereNull('user_id')->orWhere('user_id', $user->id);
        });
    }

    /**
     * Unread for a user. A personal notification uses `read_at`; a business-wide
     * one is unread until that user has a row in `notification_reads`.
     */
    public function scopeUnreadFor(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $inner) use ($user): void {
            $inner->where(function (Builder $personal) use ($user): void {
                $personal->where('user_id', $user->id)->whereNull('read_at');
            })->orWhere(function (Builder $shared) use ($user): void {
                $shared->whereNull('user_id')
                    ->whereDoesntHave('readers', fn (Builder $r) => $r->where('users.id', $user->id));
            });
        });
    }

    public function scopeOfType(Builder $query, ?string $type): Builder
    {
        return $type === null ? $query : $query->where('type', $type);
    }
}
