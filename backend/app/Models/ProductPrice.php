<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * The current reference price for a product.
 *
 * Reference data only. Nothing in the inventory engine reads this model —
 * see docs/ARCHITECTURE.md → "Pricing is a reference catalogue".
 *
 * @property int $product_id
 * @property string $reference_price
 * @property string $currency
 * @property Carbon $effective_from
 */
class ProductPrice extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'product_id',
        'reference_price',
        'currency',
        'effective_from',
        'source',
        'image_path',
        'notes',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'reference_price' => 'decimal:4',
            'effective_from' => 'date',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function history(): HasMany
    {
        return $this->hasMany(ProductPriceHistory::class, 'product_id', 'product_id')
            ->latest('effective_from');
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($term)).'%';

        return $query->whereHas('product', function (Builder $inner) use ($like): void {
            $inner->where('name', 'like', $like)->orWhere('sku', 'like', $like);
        });
    }
}
