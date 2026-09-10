<?php

declare(strict_types=1);

namespace App\Services\Reports;

use App\Enums\MovementType;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Models\InventoryLedgerEntry;
use App\Models\Product;
use App\Models\ProductPriceHistory;
use App\Models\StockMovement;
use App\Models\Supplier;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Builds every report in the Reports module.
 *
 * Each method returns a paginated query result so large catalogues stay fast;
 * the matching `*Rows()` method returns a lazy generator for CSV export so an
 * export never loads the whole result set into memory.
 *
 * Filters arrive as an already-validated array from
 * {@see ReportFilterRequest}.
 */
final class ReportService
{
    /**
     * Inventory summary: one row per product with its current position.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function inventorySummary(array $filters): LengthAwarePaginator
    {
        return $this->inventorySummaryQuery($filters)
            ->paginate($this->perPage($filters))
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Product>
     */
    public function inventorySummaryQuery(array $filters): Builder
    {
        return Product::query()
            ->with(['category', 'price'])
            ->search($filters['search'] ?? null)
            ->when(
                isset($filters['category_id']),
                fn (Builder $q): Builder => $q->where('products.category_id', $filters['category_id'])
            )
            ->when(
                isset($filters['supplier_id']),
                fn (Builder $q): Builder => $q->whereHas(
                    'suppliers',
                    fn (Builder $s): Builder => $s->where('suppliers.id', $filters['supplier_id'])
                )
            )
            ->stockStatus($filters['stock_status'] ?? null)
            ->when(
                ($filters['include_archived'] ?? false) === false,
                fn (Builder $q): Builder => $q->active()
            )
            ->orderBy(
                'products.'.$this->sortColumn($filters, ['name', 'sku', 'quantity_on_hand', 'minimum_stock_level', 'created_at'], 'name'),
                $this->sortDirection($filters)
            );
    }

    /**
     * Stock movement report, filterable by type. Used for the Stock IN report,
     * the Stock OUT report and the combined product-movement report.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, StockMovement>
     */
    public function movements(array $filters, ?MovementType $type = null): LengthAwarePaginator
    {
        return $this->movementsQuery($filters, $type)
            ->paginate($this->perPage($filters))
            ->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<StockMovement>
     */
    public function movementsQuery(array $filters, ?MovementType $type = null): Builder
    {
        return StockMovement::query()
            ->with([
                'product:id,name,sku,unit,category_id',
                'product.category',
                'supplier:id,name',
                'creator:id,name',
                'batch:id,batch_number,received_at',
            ])
            ->ofType($type)
            ->between($filters['date_from'] ?? null, $filters['date_to'] ?? null)
            ->when(
                isset($filters['product_id']),
                fn (Builder $q): Builder => $q->where('stock_movements.product_id', $filters['product_id'])
            )
            ->when(
                isset($filters['supplier_id']),
                fn (Builder $q): Builder => $q->where('stock_movements.supplier_id', $filters['supplier_id'])
            )
            ->when(
                isset($filters['category_id']),
                fn (Builder $q): Builder => $q->whereHas(
                    'product',
                    fn (Builder $p): Builder => $p->where('products.category_id', $filters['category_id'])
                )
            )
            ->when(
                filled($filters['search'] ?? null),
                fn (Builder $q): Builder => $q->where(function (Builder $inner) use ($filters): void {
                    $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim((string) $filters['search'])).'%';
                    $inner->where('stock_movements.reference', 'like', $like)
                        ->orWhere('stock_movements.notes', 'like', $like)
                        ->orWhereHas('product', function (Builder $p) use ($like): void {
                            $p->where('products.name', 'like', $like)->orWhere('products.sku', 'like', $like);
                        });
                })
            )
            ->orderBy(
                'stock_movements.'.$this->sortColumn($filters, ['occurred_at', 'quantity', 'balance_after'], 'occurred_at'),
                $this->sortDirection($filters, 'desc')
            )
            ->orderByDesc('stock_movements.id');
    }

    /**
     * Low-stock report.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function lowStock(array $filters): LengthAwarePaginator
    {
        return $this->lowStockQuery($filters)->paginate($this->perPage($filters))->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Product>
     */
    public function lowStockQuery(array $filters): Builder
    {
        return Product::query()
            ->active()
            ->lowStock()
            ->with(['category', 'suppliers:id,name'])
            ->search($filters['search'] ?? null)
            ->when(
                isset($filters['category_id']),
                fn (Builder $q): Builder => $q->where('products.category_id', $filters['category_id'])
            )
            ->orderBy('products.quantity_on_hand')
            ->orderBy('products.name');
    }

    /**
     * Out-of-stock report.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function outOfStock(array $filters): LengthAwarePaginator
    {
        return $this->outOfStockQuery($filters)->paginate($this->perPage($filters))->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Product>
     */
    public function outOfStockQuery(array $filters): Builder
    {
        return Product::query()
            ->active()
            ->outOfStock()
            ->with(['category', 'suppliers:id,name'])
            ->search($filters['search'] ?? null)
            ->when(
                isset($filters['category_id']),
                fn (Builder $q): Builder => $q->where('products.category_id', $filters['category_id'])
            )
            ->orderBy('products.name');
    }

    /**
     * Supplier report: units supplied, batches and distinct products per supplier.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Supplier>
     */
    public function suppliers(array $filters): LengthAwarePaginator
    {
        return $this->suppliersQuery($filters)->paginate($this->perPage($filters))->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Supplier>
     */
    public function suppliersQuery(array $filters): Builder
    {
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        $batchConstraint = function (Builder $query) use ($dateFrom, $dateTo): void {
            $query->when($dateFrom, fn (Builder $q, string $v): Builder => $q->where('received_at', '>=', $v.' 00:00:00'))
                ->when($dateTo, fn (Builder $q, string $v): Builder => $q->where('received_at', '<=', $v.' 23:59:59'));
        };

        return Supplier::query()
            ->search($filters['search'] ?? null)
            ->when(
                ($filters['include_inactive'] ?? false) === false,
                fn (Builder $q): Builder => $q->active()
            )
            ->withCount(['products as linked_products_count'])
            ->withCount(['stockBatches as batches_count' => $batchConstraint])
            ->withSum(['stockBatches as units_supplied' => $batchConstraint], 'quantity_received')
            ->orderBy($this->sortColumn($filters, ['name', 'units_supplied', 'batches_count'], 'name'), $this->sortDirection($filters));
    }

    /**
     * Inventory ledger report.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, InventoryLedgerEntry>
     */
    public function ledger(array $filters): LengthAwarePaginator
    {
        return $this->ledgerQuery($filters)->paginate($this->perPage($filters))->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<InventoryLedgerEntry>
     */
    public function ledgerQuery(array $filters): Builder
    {
        return InventoryLedgerEntry::query()
            ->with([
                'product:id,name,sku,unit',
                'supplier:id,name',
                'batch:id,batch_number,received_at',
                'user:id,name',
            ])
            ->between($filters['date_from'] ?? null, $filters['date_to'] ?? null)
            ->when(
                isset($filters['product_id']),
                fn (Builder $q): Builder => $q->where('product_id', $filters['product_id'])
            )
            ->when(
                isset($filters['supplier_id']),
                fn (Builder $q): Builder => $q->where('supplier_id', $filters['supplier_id'])
            )
            ->when(
                filled($filters['type'] ?? null),
                fn (Builder $q): Builder => $q->where('type', $filters['type'])
            )
            ->chronological($this->sortDirection($filters, 'desc'));
    }

    /**
     * Price / reference history report.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, ProductPriceHistory>
     */
    public function priceHistory(array $filters): LengthAwarePaginator
    {
        return $this->priceHistoryQuery($filters)->paginate($this->perPage($filters))->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<ProductPriceHistory>
     */
    public function priceHistoryQuery(array $filters): Builder
    {
        return ProductPriceHistory::query()
            ->with(['product:id,name,sku,unit', 'recordedBy:id,name'])
            ->when(
                isset($filters['product_id']),
                fn (Builder $q): Builder => $q->where('product_id', $filters['product_id'])
            )
            ->when(
                isset($filters['category_id']),
                fn (Builder $q): Builder => $q->whereHas(
                    'product',
                    fn (Builder $p): Builder => $p->where('products.category_id', $filters['category_id'])
                )
            )
            ->when(
                filled($filters['date_from'] ?? null),
                fn (Builder $q): Builder => $q->where('effective_from', '>=', $filters['date_from'])
            )
            ->when(
                filled($filters['date_to'] ?? null),
                fn (Builder $q): Builder => $q->where('effective_from', '<=', $filters['date_to'])
            )
            ->when(
                filled($filters['search'] ?? null),
                fn (Builder $q): Builder => $q->whereHas('product', function (Builder $p) use ($filters): void {
                    $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim((string) $filters['search'])).'%';
                    $p->where('products.name', 'like', $like)->orWhere('products.sku', 'like', $like);
                })
            )
            ->orderByDesc('effective_from')
            ->orderByDesc('id');
    }

    /**
     * Aggregate totals shown above each report table.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, int|float>
     */
    public function movementTotals(array $filters, ?MovementType $type = null): array
    {
        $base = $this->movementsQuery($filters, $type);

        // Aggregate queries select only the computed columns, so the eager loads
        // must be dropped — otherwise Eloquent tries to resolve relationships
        // from foreign keys that were never selected.
        $row = (clone $base)
            ->reorder()
            ->setEagerLoads([])
            ->selectRaw('COUNT(*) as movements, COALESCE(SUM(stock_movements.quantity), 0) as units')
            ->first();

        return [
            'movements' => (int) ($row->movements ?? 0),
            'units' => (int) ($row->units ?? 0),
            'products' => (int) (clone $base)->reorder()->distinct()->count('stock_movements.product_id'),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, int>
     */
    public function inventoryTotals(array $filters): array
    {
        $base = $this->inventorySummaryQuery($filters)->reorder()->setEagerLoads([]);

        $row = (clone $base)
            ->selectRaw('COUNT(*) as products, COALESCE(SUM(products.quantity_on_hand), 0) as units')
            ->first();

        return [
            'products' => (int) ($row->products ?? 0),
            'units' => (int) ($row->units ?? 0),
            'low_stock' => (clone $base)->lowStock()->count(),
            'out_of_stock' => (clone $base)->outOfStock()->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function perPage(array $filters): int
    {
        $perPage = (int) ($filters['per_page'] ?? 25);

        return max(5, min($perPage, 200));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array<int, string>  $allowed
     */
    private function sortColumn(array $filters, array $allowed, string $default): string
    {
        $requested = (string) ($filters['sort'] ?? '');

        return in_array($requested, $allowed, true) ? $requested : $default;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function sortDirection(array $filters, string $default = 'asc'): string
    {
        $direction = strtolower((string) ($filters['direction'] ?? $default));

        return $direction === 'desc' ? 'desc' : 'asc';
    }

    /**
     * Stream any report query as CSV rows without loading it all into memory.
     *
     * @param  Builder<covariant \Illuminate\Database\Eloquent\Model>  $query
     * @param  callable(Model): array<int, string|int|float|null>  $mapper
     * @param  array<int, string>  $headers
     * @return \Generator<int, array<int, string|int|float|null>>
     */
    public function streamCsv(Builder $query, array $headers, callable $mapper): \Generator
    {
        yield $headers;

        foreach ($query->reorder()->orderBy($query->getModel()->getQualifiedKeyName())->lazyById(500) as $model) {
            yield $mapper($model);
        }
    }

    /**
     * Sum of `quantity_on_hand` across the whole tenant. Separate from the
     * report filters because the dashboard and exports both want the raw total.
     */
    public function totalUnitsOnHand(): int
    {
        return (int) Product::query()->active()->sum(DB::raw('quantity_on_hand'));
    }
}
