<?php

declare(strict_types=1);

namespace App\Services\Reports;

use App\Enums\MovementType;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Notification;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Assembles the dashboard payload in one place.
 *
 * Every query here is tenant-scoped automatically through the models' global
 * scope. Counts use indexed columns so the dashboard stays fast as catalogues
 * grow; no query loads full product rows just to count them.
 */
final class DashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function forUser(User $user, int $movementDays = 30): array
    {
        $since = Carbon::now()->subDays($movementDays)->startOfDay();

        return [
            'kpis' => $this->kpis($since),
            'movement_trend' => $this->movementTrend($since),
            'recent_stock_in' => $this->recentMovements(MovementType::StockIn),
            'recent_stock_out' => $this->recentMovements(MovementType::StockOut),
            'low_stock' => $this->lowStockProducts(),
            'out_of_stock' => $this->outOfStockProducts(),
            'top_movers' => $this->topMovers($since),
            'category_breakdown' => $this->categoryBreakdown(),
            'recent_activity' => $this->recentActivity(),
            'recent_notifications' => $this->recentNotifications($user),
            'period' => [
                'days' => $movementDays,
                'from' => $since->toDateString(),
                'to' => Carbon::now()->toDateString(),
            ],
        ];
    }

    /**
     * @return array<string, int>
     */
    private function kpis(Carbon $since): array
    {
        $productStats = Product::query()
            ->active()
            ->selectRaw('COUNT(*) as total_products')
            ->selectRaw('COALESCE(SUM(quantity_on_hand), 0) as total_units')
            ->first();

        $movementStats = StockMovement::query()
            ->where('occurred_at', '>=', $since)
            ->selectRaw('type, COALESCE(SUM(quantity), 0) as units, COUNT(*) as movements')
            ->groupBy('type')
            ->get()
            ->keyBy(fn (StockMovement $row): string => $row->type->value);

        return [
            'total_products' => (int) ($productStats->total_products ?? 0),
            'total_inventory_units' => (int) ($productStats->total_units ?? 0),
            'low_stock_count' => Product::query()->active()->lowStock()->count(),
            'out_of_stock_count' => Product::query()->active()->outOfStock()->count(),
            'stock_in_units' => (int) ($movementStats[MovementType::StockIn->value]->units ?? 0),
            'stock_out_units' => (int) ($movementStats[MovementType::StockOut->value]->units ?? 0),
            'stock_in_movements' => (int) ($movementStats[MovementType::StockIn->value]->movements ?? 0),
            'stock_out_movements' => (int) ($movementStats[MovementType::StockOut->value]->movements ?? 0),
            'adjustment_movements' => (int) ($movementStats[MovementType::Adjustment->value]->movements ?? 0),
            'active_suppliers' => Supplier::query()->active()->count(),
            'categories_count' => Category::query()->active()->count(),
        ];
    }

    /**
     * Daily stock-in vs stock-out units, for the dashboard chart.
     *
     * @return array<int, array{date: string, stock_in: int, stock_out: int}>
     */
    private function movementTrend(Carbon $since): array
    {
        $dateExpression = $this->dateExpression('occurred_at');

        $rows = StockMovement::query()
            ->where('occurred_at', '>=', $since)
            ->selectRaw("{$dateExpression} as day, type, COALESCE(SUM(quantity), 0) as units")
            ->groupByRaw("{$dateExpression}, type")
            ->get();

        /** @var array<string, array{date: string, stock_in: int, stock_out: int}> $series */
        $series = [];
        $cursor = $since->copy();
        $today = Carbon::now()->startOfDay();

        while ($cursor->lessThanOrEqualTo($today)) {
            $series[$cursor->toDateString()] = [
                'date' => $cursor->toDateString(),
                'stock_in' => 0,
                'stock_out' => 0,
            ];
            $cursor->addDay();
        }

        foreach ($rows as $row) {
            $day = (string) $row->getAttribute('day');

            if (! isset($series[$day])) {
                continue;
            }

            $units = (int) $row->getAttribute('units');

            if ($row->type === MovementType::StockIn) {
                $series[$day]['stock_in'] += $units;
            } elseif ($row->type === MovementType::StockOut) {
                $series[$day]['stock_out'] += $units;
            }
        }

        return array_values($series);
    }

    /**
     * @return Collection<int, StockMovement>
     */
    private function recentMovements(MovementType $type, int $limit = 6): Collection
    {
        return StockMovement::query()
            ->where('type', $type->value)
            ->with(['product:id,name,sku,unit', 'supplier:id,name', 'creator:id,name'])
            ->latest('occurred_at')
            ->latest('id')
            ->limit($limit)
            ->get();
    }

    /**
     * @return Collection<int, Product>
     */
    private function lowStockProducts(int $limit = 8): Collection
    {
        return Product::query()
            ->active()
            ->lowStock()
            ->with('category')
            ->orderBy('quantity_on_hand')
            ->limit($limit)
            ->get();
    }

    /**
     * @return Collection<int, Product>
     */
    private function outOfStockProducts(int $limit = 8): Collection
    {
        return Product::query()
            ->active()
            ->outOfStock()
            ->with('category')
            ->orderBy('name')
            ->limit($limit)
            ->get();
    }

    /**
     * Products with the most outbound units in the period.
     *
     * @return array<int, array{product_id: int, name: string, sku: string, units_out: int}>
     */
    private function topMovers(Carbon $since, int $limit = 5): array
    {
        return StockMovement::query()
            ->where('type', MovementType::StockOut->value)
            ->where('occurred_at', '>=', $since)
            ->join('products', 'products.id', '=', 'stock_movements.product_id')
            ->groupBy('stock_movements.product_id', 'products.name', 'products.sku')
            ->orderByDesc('units_out')
            ->limit($limit)
            ->get([
                'stock_movements.product_id',
                'products.name',
                'products.sku',
                DB::raw('COALESCE(SUM(stock_movements.quantity), 0) as units_out'),
            ])
            ->map(static fn ($row): array => [
                'product_id' => (int) $row->product_id,
                'name' => (string) $row->name,
                'sku' => (string) $row->sku,
                'units_out' => (int) $row->units_out,
            ])
            ->all();
    }

    /**
     * Units on hand grouped by category, for the inventory overview chart.
     *
     * @return array<int, array{category: string, color: string|null, products: int, units: int}>
     */
    private function categoryBreakdown(int $limit = 6): array
    {
        return Product::query()
            ->active()
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->groupBy('categories.id', 'categories.name', 'categories.color')
            ->orderByDesc('units')
            ->limit($limit)
            ->get([
                DB::raw('categories.name as category_name'),
                DB::raw('categories.color as category_color'),
                DB::raw('COUNT(products.id) as products'),
                DB::raw('COALESCE(SUM(products.quantity_on_hand), 0) as units'),
            ])
            ->map(static fn ($row): array => [
                'category' => (string) ($row->category_name ?? 'Uncategorised'),
                'color' => $row->category_color,
                'products' => (int) $row->products,
                'units' => (int) $row->units,
            ])
            ->all();
    }

    /**
     * @return Collection<int, AuditLog>
     */
    private function recentActivity(int $limit = 8): Collection
    {
        return AuditLog::query()
            ->latest('created_at')
            ->latest('id')
            ->limit($limit)
            ->get();
    }

    /**
     * @return Collection<int, Notification>
     */
    private function recentNotifications(User $user, int $limit = 5): Collection
    {
        return Notification::query()
            ->visibleTo($user)
            ->latest('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Portable "truncate a timestamp to a date" expression.
     *
     * PostgreSQL is the production engine; SQLite backs the test suite.
     */
    private function dateExpression(string $column): string
    {
        return match (DB::getDriverName()) {
            'pgsql' => "to_char({$column}, 'YYYY-MM-DD')",
            'sqlite' => "strftime('%Y-%m-%d', {$column})",
            default => "DATE({$column})",
        };
    }
}
