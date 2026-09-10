<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\MovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Http\Resources\LedgerEntryResource;
use App\Http\Resources\ProductPriceHistoryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\StockMovementResource;
use App\Http\Resources\SupplierResource;
use App\Models\InventoryLedgerEntry;
use App\Models\Product;
use App\Models\ProductPriceHistory;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\Reports\ReportService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The Reports module.
 *
 * Every report shares one filter contract ({@see ReportFilterRequest}) and every
 * report can be exported as CSV through the same streaming path, so adding a
 * report means adding a query and a row mapper — not a new export mechanism.
 */
final class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reports) {}

    /**
     * GET /api/v1/reports/inventory-summary
     */
    public function inventorySummary(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return ProductResource::collection($this->reports->inventorySummary($request->filters()))
            ->additional(['meta' => ['totals' => $this->reports->inventoryTotals($request->filters())]]);
    }

    /**
     * GET /api/v1/reports/stock-in
     */
    public function stockIn(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return $this->movementReport($request, MovementType::StockIn);
    }

    /**
     * GET /api/v1/reports/stock-out
     */
    public function stockOut(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return $this->movementReport($request, MovementType::StockOut);
    }

    /**
     * GET /api/v1/reports/product-movement — all movement types together.
     */
    public function productMovement(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return $this->movementReport($request, $request->movementType());
    }

    /**
     * GET /api/v1/reports/low-stock
     */
    public function lowStock(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return ProductResource::collection($this->reports->lowStock($request->filters()));
    }

    /**
     * GET /api/v1/reports/out-of-stock
     */
    public function outOfStock(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return ProductResource::collection($this->reports->outOfStock($request->filters()));
    }

    /**
     * GET /api/v1/reports/suppliers
     */
    public function suppliers(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return SupplierResource::collection($this->reports->suppliers($request->filters()));
    }

    /**
     * GET /api/v1/reports/ledger
     */
    public function ledger(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return LedgerEntryResource::collection($this->reports->ledger($request->filters()));
    }

    /**
     * GET /api/v1/reports/price-history
     */
    public function priceHistory(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('reports.view');

        return ProductPriceHistoryResource::collection($this->reports->priceHistory($request->filters()));
    }

    /**
     * GET /api/v1/reports/{report}/export
     *
     * Streams CSV so an export of a large catalogue never buffers the whole
     * result set in memory.
     */
    public function export(ReportFilterRequest $request, string $report): StreamedResponse
    {
        $this->authorize('reports.export');

        $filters = $request->filters();

        [$query, $headers, $mapper] = match ($report) {
            'inventory-summary' => $this->inventoryExport($filters),
            'stock-in' => $this->movementExport($filters, MovementType::StockIn),
            'stock-out' => $this->movementExport($filters, MovementType::StockOut),
            'product-movement' => $this->movementExport($filters, $request->movementType()),
            'low-stock' => $this->productExport($this->reports->lowStockQuery($filters)),
            'out-of-stock' => $this->productExport($this->reports->outOfStockQuery($filters)),
            'suppliers' => $this->supplierExport($filters),
            'ledger' => $this->ledgerExport($filters),
            'price-history' => $this->priceHistoryExport($filters),
            default => abort(404, 'Unknown report.'),
        };

        $filename = sprintf('fastsold-%s-%s.csv', $report, now()->format('Y-m-d'));

        return response()->streamDownload(function () use ($query, $headers, $mapper): void {
            $handle = fopen('php://output', 'wb');

            foreach ($this->reports->streamCsv($query, $headers, $mapper) as $row) {
                fputcsv($handle, $row);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ]);
    }

    private function movementReport(ReportFilterRequest $request, ?MovementType $type): AnonymousResourceCollection
    {
        return StockMovementResource::collection($this->reports->movements($request->filters(), $type))
            ->additional(['meta' => ['totals' => $this->reports->movementTotals($request->filters(), $type)]]);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: Builder<Product>, 1: array<int, string>, 2: callable}
     */
    private function inventoryExport(array $filters): array
    {
        return $this->productExport($this->reports->inventorySummaryQuery($filters));
    }

    /**
     * @param  Builder<Product>  $query
     * @return array{0: Builder<Product>, 1: array<int, string>, 2: callable}
     */
    private function productExport(Builder $query): array
    {
        return [
            $query->with(['category:id,name', 'price:id,product_id,reference_price,currency']),
            ['SKU', 'Name', 'Category', 'Unit', 'Quantity on hand', 'Minimum level', 'Stock status', 'Reference price', 'Currency'],
            static fn (Product $product): array => [
                $product->sku,
                $product->name,
                $product->category?->name ?? '',
                $product->unit->abbreviation(),
                $product->quantity_on_hand,
                $product->minimum_stock_level,
                $product->stockStatus()->label(),
                $product->price?->reference_price ?? '',
                $product->price?->currency ?? '',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: Builder<StockMovement>, 1: array<int, string>, 2: callable}
     */
    private function movementExport(array $filters, ?MovementType $type): array
    {
        return [
            $this->reports->movementsQuery($filters, $type),
            ['Date', 'Type', 'SKU', 'Product', 'Quantity', 'Balance after', 'Supplier', 'Reference', 'Reason', 'Recorded by', 'Notes'],
            static fn (StockMovement $movement): array => [
                $movement->occurred_at?->toDateTimeString() ?? '',
                $movement->type->label(),
                $movement->product?->sku ?? '',
                $movement->product?->name ?? '',
                $movement->signedQuantity(),
                $movement->balance_after,
                $movement->supplier?->name ?? '',
                $movement->reference ?? '',
                $movement->reason ?? '',
                $movement->creator?->name ?? '',
                $movement->notes ?? '',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: Builder<Supplier>, 1: array<int, string>, 2: callable}
     */
    private function supplierExport(array $filters): array
    {
        return [
            $this->reports->suppliersQuery($filters),
            ['Name', 'Code', 'Contact', 'Email', 'Phone', 'Active', 'Linked products', 'Batches', 'Units supplied'],
            static fn (Supplier $supplier): array => [
                $supplier->name,
                $supplier->code ?? '',
                $supplier->contact_name ?? '',
                $supplier->email ?? '',
                $supplier->phone ?? '',
                $supplier->is_active ? 'Yes' : 'No',
                (int) ($supplier->linked_products_count ?? 0),
                (int) ($supplier->batches_count ?? 0),
                (int) ($supplier->units_supplied ?? 0),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: Builder<InventoryLedgerEntry>, 1: array<int, string>, 2: callable}
     */
    private function ledgerExport(array $filters): array
    {
        return [
            $this->reports->ledgerQuery($filters),
            ['Date', 'Type', 'SKU', 'Product', 'Quantity change', 'Balance after', 'Batch', 'Supplier', 'Reference', 'User'],
            static fn (InventoryLedgerEntry $entry): array => [
                $entry->occurred_at?->toDateTimeString() ?? '',
                $entry->type->label(),
                $entry->product?->sku ?? '',
                $entry->product?->name ?? '',
                $entry->quantity_change,
                $entry->balance_after,
                $entry->batch?->batch_number ?? '',
                $entry->supplier?->name ?? '',
                $entry->reference ?? '',
                $entry->user?->name ?? '',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: Builder<ProductPriceHistory>, 1: array<int, string>, 2: callable}
     */
    private function priceHistoryExport(array $filters): array
    {
        return [
            $this->reports->priceHistoryQuery($filters),
            ['Effective from', 'Effective to', 'SKU', 'Product', 'Reference price', 'Previous price', 'Change %', 'Currency', 'Source', 'Recorded by'],
            static fn (ProductPriceHistory $row): array => [
                $row->effective_from?->toDateString() ?? '',
                $row->effective_to?->toDateString() ?? '',
                $row->product?->sku ?? '',
                $row->product?->name ?? '',
                $row->reference_price,
                $row->previous_price ?? '',
                $row->changePercentage() ?? '',
                $row->currency,
                $row->source ?? '',
                $row->recordedBy?->name ?? '',
            ],
        ];
    }
}
