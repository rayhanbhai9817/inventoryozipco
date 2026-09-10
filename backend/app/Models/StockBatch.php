<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Database\Factories\StockBatchFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One receipt of stock — the unit FIFO consumes.
 *
 * @property int $id
 * @property int $business_id
 * @property int $product_id
 * @property int|null $supplier_id
 * @property string $batch_number
 * @property int $quantity_received
 * @property int $quantity_remaining
 * @property Carbon $received_at
 */
class StockBatch extends Model
{
    /** @use HasFactory<StockBatchFactory> */
    use BelongsToBusiness;

    use HasFactory;

    protected $fillable = [
        'business_id',
        'product_id',
        'supplier_id',
        'batch_number',
        'reference',
        'quantity_received',
        'quantity_remaining',
        'unit_cost',
        'currency',
        'received_at',
        'expires_at',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity_received' => 'integer',
            'quantity_remaining' => 'integer',
            'unit_cost' => 'decimal:4',
            'received_at' => 'datetime',
            'expires_at' => 'date',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(StockMovementAllocation::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(InventoryLedgerEntry::class);
    }

    public function quantityConsumed(): int
    {
        return $this->quantity_received - $this->quantity_remaining;
    }

    public function isDepleted(): bool
    {
        return $this->quantity_remaining <= 0;
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * Open batches, oldest first. `id` is the tie-breaker so FIFO order is
     * deterministic even for batches received in the same instant.
     */
    public function scopeFifo(Builder $query): Builder
    {
        return $query->where('quantity_remaining', '>', 0)
            ->orderBy('received_at')
            ->orderBy('id');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('quantity_remaining', '>', 0);
    }
}
