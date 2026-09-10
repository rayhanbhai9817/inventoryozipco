<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ProductUnit;
use App\Enums\StockStatus;
use App\Models\Concerns\BelongsToBusiness;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $business_id
 * @property int|null $category_id
 * @property string $sku
 * @property string $name
 * @property ProductUnit $unit
 * @property int $minimum_stock_level
 * @property int $quantity_on_hand
 * @property bool $is_active
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use BelongsToBusiness;

    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'business_id',
        'category_id',
        'sku',
        'barcode',
        'name',
        'description',
        'unit',
        'image_path',
        'minimum_stock_level',
        'reorder_quantity',
        'is_active',
        'archived_at',
        'created_by',
    ];

    // NOTE: `quantity_on_hand` is intentionally absent from $fillable. It is
    // maintained exclusively by App\Services\Inventory\InventoryService inside a
    // database transaction, so no request payload can ever write to it.

    protected function casts(): array
    {
        return [
            'unit' => ProductUnit::class,
            'minimum_stock_level' => 'integer',
            'reorder_quantity' => 'integer',
            'quantity_on_hand' => 'integer',
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function suppliers(): BelongsToMany
    {
        return $this->belongsToMany(Supplier::class, 'supplier_product')
            ->withPivot(['supplier_sku', 'lead_time_days', 'minimum_order_quantity', 'is_preferred'])
            ->withTimestamps();
    }

    public function stockBatches(): HasMany
    {
        return $this->hasMany(StockBatch::class);
    }

    /**
     * Batches that still hold stock, in FIFO order.
     */
    public function openBatches(): HasMany
    {
        return $this->stockBatches()
            ->where('quantity_remaining', '>', 0)
            ->orderBy('received_at')
            ->orderBy('id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(InventoryLedgerEntry::class);
    }

    public function price(): HasOne
    {
        return $this->hasOne(ProductPrice::class);
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(ProductPriceHistory::class)->latest('effective_from');
    }

    public function stockStatus(): StockStatus
    {
        return StockStatus::forQuantity($this->quantity_on_hand, $this->minimum_stock_level);
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null || ! $this->is_active;
    }

    // Scopes qualify their columns because several reporting queries join
    // `products` against `categories`, which also has `is_active` and `name`.

    public function scopeActive(Builder $query): Builder
    {
        return $query->where($this->qualifyColumn('is_active'), true)
            ->whereNull($this->qualifyColumn('archived_at'));
    }

    public function scopeArchived(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where($this->qualifyColumn('is_active'), false)
            ->orWhereNotNull($this->qualifyColumn('archived_at')));
    }

    public function scopeLowStock(Builder $query): Builder
    {
        return $query
            ->whereColumn($this->qualifyColumn('quantity_on_hand'), '<=', $this->qualifyColumn('minimum_stock_level'))
            ->where($this->qualifyColumn('minimum_stock_level'), '>', 0)
            ->where($this->qualifyColumn('quantity_on_hand'), '>', 0);
    }

    public function scopeOutOfStock(Builder $query): Builder
    {
        return $query->where($this->qualifyColumn('quantity_on_hand'), '<=', 0);
    }

    public function scopeInStock(Builder $query): Builder
    {
        return $query->where($this->qualifyColumn('quantity_on_hand'), '>', 0)
            ->where(function (Builder $inner): void {
                $inner->where($this->qualifyColumn('minimum_stock_level'), '<=', 0)
                    ->orWhereColumn($this->qualifyColumn('quantity_on_hand'), '>', $this->qualifyColumn('minimum_stock_level'));
            });
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($term)).'%';

        return $query->where(function (Builder $inner) use ($like): void {
            $inner->where($this->qualifyColumn('name'), 'like', $like)
                ->orWhere($this->qualifyColumn('sku'), 'like', $like)
                ->orWhere($this->qualifyColumn('barcode'), 'like', $like)
                ->orWhere($this->qualifyColumn('description'), 'like', $like);
        });
    }

    /**
     * Apply a named stock-status filter, used by the products index and reports.
     */
    public function scopeStockStatus(Builder $query, ?string $status): Builder
    {
        return match ($status) {
            StockStatus::LowStock->value => $this->scopeLowStock($query),
            StockStatus::OutOfStock->value => $this->scopeOutOfStock($query),
            StockStatus::InStock->value => $this->scopeInStock($query),
            default => $query,
        };
    }
}
