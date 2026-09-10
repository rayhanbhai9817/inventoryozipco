<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use App\Services\Pricing\PriceCatalogService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Append-only record of every reference price that has been in effect.
 *
 * The newest row has `effective_to = null`; recording a new price stamps the
 * previous row's `effective_to` to close its window. That closing stamp is the
 * only field ever written after insert — the price itself, its effective_from
 * and who recorded it are history and are never edited. No route exposes a
 * write; all changes go through
 * {@see PriceCatalogService}.
 *
 * @property int $product_id
 * @property string $reference_price
 * @property string|null $previous_price
 * @property Carbon $effective_from
 * @property Carbon|null $effective_to
 */
class ProductPriceHistory extends Model
{
    use BelongsToBusiness;

    public const UPDATED_AT = null;

    protected $table = 'product_price_history';

    protected $fillable = [
        'business_id',
        'product_id',
        'reference_price',
        'previous_price',
        'currency',
        'effective_from',
        'effective_to',
        'source',
        'image_path',
        'notes',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'reference_price' => 'decimal:4',
            'previous_price' => 'decimal:4',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Percentage change against the previous price, or null when this is the
     * first price recorded for the product.
     */
    public function changePercentage(): ?float
    {
        if ($this->previous_price === null || (float) $this->previous_price === 0.0) {
            return null;
        }

        $previous = (float) $this->previous_price;

        return round(((float) $this->reference_price - $previous) / $previous * 100, 2);
    }
}
