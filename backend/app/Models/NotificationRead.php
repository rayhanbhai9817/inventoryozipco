<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Read receipt for a business-wide notification.
 *
 * Not tenant-scoped directly: it is reachable only through a notification that
 * is itself scoped, and carries no business data of its own.
 */
class NotificationRead extends Model
{
    public $timestamps = false;

    protected $fillable = ['notification_id', 'user_id', 'read_at'];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
