<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Data\StockAdjustmentData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StockAdjustmentRequest;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Http\Resources\LedgerEntryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\StockBatchResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Models\StockBatch;
use App\Services\Inventory\InventoryService;
use App\Services\Reports\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Inventory overview, the ledger, batches, and adjustments.
 */
final class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventory) {}

    /**
     * GET /api/v1/inventory — current position per product.
     */
    public function index(ReportFilterRequest $request, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('inventory.view');

        $products = $reports->inventorySummary($request->filters());

        return ProductResource::collection($products)->additional([
            'meta' => ['totals' => $reports->inventoryTotals($request->filters())],
        ]);
    }

    /**
     * GET /api/v1/inventory/ledger — the immutable inventory ledger.
     */
    public function ledger(ReportFilterRequest $request, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('inventory.view');

        return LedgerEntryResource::collection($reports->ledger($request->filters()));
    }

    /**
     * GET /api/v1/inventory/movements — every movement type combined.
     */
    public function movements(ReportFilterRequest $request, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('inventory.view');

        $movements = $reports->movements($request->filters(), $request->movementType());

        return StockMovementResource::collection($movements)->additional([
            'meta' => ['totals' => $reports->movementTotals($request->filters(), $request->movementType())],
        ]);
    }

    /**
     * GET /api/v1/inventory/batches — batch tracking across the business.
     */
    public function batches(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('inventory.view');

        $filters = $request->filters();

        $batches = StockBatch::query()
            ->with(['product:id,name,sku,unit,category_id', 'supplier:id,name'])
            ->when(
                isset($filters['product_id']),
                fn ($query) => $query->where('product_id', $filters['product_id'])
            )
            ->when(
                isset($filters['supplier_id']),
                fn ($query) => $query->where('supplier_id', $filters['supplier_id'])
            )
            ->when(
                ($filters['include_depleted'] ?? false) === false,
                fn ($query) => $query->open()
            )
            ->orderBy('received_at')
            ->orderBy('id')
            ->paginate((int) ($filters['per_page'] ?? 25))
            ->withQueryString();

        return StockBatchResource::collection($batches);
    }

    /**
     * POST /api/v1/inventory/adjustments
     *
     * A signed correction. Negative adjustments consume FIFO and are subject to
     * the same non-negative guarantee as stock out.
     */
    public function adjust(StockAdjustmentRequest $request): JsonResponse
    {
        /** @var Product $product */
        $product = Product::query()->findOrFail($request->integer('product_id'));

        $this->authorize('inventory.adjust', $product);

        $movement = $this->inventory->adjust(
            StockAdjustmentData::fromValidated($request->validated()),
            $request->user(),
        );

        return (new StockMovementResource($movement->load(['product', 'allocations.batch', 'creator'])))
            ->additional(['message' => 'Adjustment recorded.'])
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/inventory/products/{product}/availability
     *
     * The authoritative available quantity, summed from open batches rather than
     * read from the denormalised cache. Used by the stock-out form.
     */
    public function availability(Product $product): JsonResponse
    {
        $this->authorize('inventory.view');

        return new JsonResponse([
            'data' => [
                'product_id' => $product->id,
                'sku' => $product->sku,
                'quantity_on_hand' => $product->quantity_on_hand,
                'available' => $this->inventory->availableQuantity($product),
                'minimum_stock_level' => $product->minimum_stock_level,
                'stock_status' => $product->stockStatus()->value,
            ],
        ]);
    }
}
