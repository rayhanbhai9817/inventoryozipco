<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MovementType;
use App\Models\Concerns\BelongsToBusiness;
use Database\Factories\StockMovementFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One recorded inventory operation against one product.
 *
 * @property int $id
 * @property int $business_id
 * @property int $product_id
 * @property MovementType $type
 * @property int $direction +1 inbound, -1 outbound
 * @property int $quantity Always a positive magnitude
 * @property int $balance_after
 * @property Carbon $occurred_at
 */
class StockMovement extends Model
{
    /** @use HasFactory<StockMovementFactory> */
    use BelongsToBusiness;

    use HasFactory;

    protected $fillable = [
        'business_id',
        'product_id',
        'type',
        'direction',
        'quantity',
        'balance_after',
        'supplier_id',
        'stock_batch_id',
        'reference',
        'reason',
        'notes',
        'occurred_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => MovementType::class,
            'direction' => 'integer',
            'quantity' => 'integer',
            'balance_after' => 'integer',
            'occurred_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class, 'stock_batch_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * For outbound movements: exactly which batches were consumed, and by how
     * much. This is the audit trail that makes FIFO verifiable.
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(StockMovementAllocation::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(InventoryLedgerEntry::class);
    }

    /**
     * Signed quantity, convenient for reports.
     */
    public function signedQuantity(): int
    {
        return $this->direction * $this->quantity;
    }

    public function scopeOfType(Builder $query, MovementType|string|null $type): Builder
    {
        if ($type === null) {
            return $query;
        }

        return $query->where('type', $type instanceof MovementType ? $type->value : $type);
    }

    public function scopeBetween(Builder $query, ?string $from, ?string $to): Builder
    {
        return $query
            ->when($from, fn (Builder $q, string $value): Builder => $q->where('occurred_at', '>=', $value.' 00:00:00'))
            ->when($to, fn (Builder $q, string $value): Builder => $q->where('occurred_at', '<=', $value.' 23:59:59'));
    }
}
