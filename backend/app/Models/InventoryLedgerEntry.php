<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MovementType;
use App\Models\Concerns\BelongsToBusiness;
use App\Models\Concerns\Immutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An immutable line in the inventory ledger.
 *
 * @property int $id
 * @property int $product_id
 * @property int $stock_movement_id
 * @property int|null $stock_batch_id
 * @property MovementType $type
 * @property int $quantity_change Signed
 * @property int $balance_after
 * @property Carbon $occurred_at
 */
class InventoryLedgerEntry extends Model
{
    use BelongsToBusiness;
    use Immutable;

    public const UPDATED_AT = null;

    protected $table = 'inventory_ledger_entries';

    protected $fillable = [
        'business_id',
        'product_id',
        'stock_movement_id',
        'stock_batch_id',
        'supplier_id',
        'type',
        'quantity_change',
        'balance_after',
        'reference',
        'notes',
        'user_id',
        'meta',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => MovementType::class,
            'quantity_change' => 'integer',
            'balance_after' => 'integer',
            'meta' => 'array',
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function movement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'stock_movement_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class, 'stock_batch_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Chronological order, with `id` as the tie-breaker so the running balance
     * column always reads consistently.
     */
    public function scopeChronological(Builder $query, string $direction = 'asc'): Builder
    {
        return $query->orderBy('occurred_at', $direction)->orderBy('id', $direction);
    }

    public function scopeBetween(Builder $query, ?string $from, ?string $to): Builder
    {
        return $query
            ->when($from, fn (Builder $q, string $value): Builder => $q->where('occurred_at', '>=', $value.' 00:00:00'))
            ->when($to, fn (Builder $q, string $value): Builder => $q->where('occurred_at', '<=', $value.' 23:59:59'));
    }
}
