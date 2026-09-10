<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use App\Models\Concerns\Immutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * How much of a specific batch an outbound movement consumed.
 *
 * Append-only: once written, the record of which batch satisfied which
 * withdrawal is history.
 *
 * @property int $stock_movement_id
 * @property int $stock_batch_id
 * @property int $quantity
 */
class StockMovementAllocation extends Model
{
    use BelongsToBusiness;
    use Immutable;

    public const UPDATED_AT = null;

    protected $fillable = [
        'business_id',
        'stock_movement_id',
        'stock_batch_id',
        'quantity',
        'unit_cost',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_cost' => 'decimal:4',
            'created_at' => 'datetime',
        ];
    }

    public function movement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class, 'stock_movement_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class, 'stock_batch_id');
    }
}
