<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Data\StockOutData;
use App\Enums\MovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StockOutRequest;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Services\Inventory\InventoryService;
use App\Services\Reports\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

final class StockOutController extends Controller
{
    public function __construct(private readonly InventoryService $inventory) {}

    /**
     * GET /api/v1/stock-out — the withdrawal history.
     */
    public function index(ReportFilterRequest $request, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('inventory.view');

        $movements = $reports->movements($request->filters(), MovementType::StockOut);

        return StockMovementResource::collection($movements)->additional([
            'meta' => ['totals' => $reports->movementTotals($request->filters(), MovementType::StockOut)],
        ]);
    }

    /**
     * POST /api/v1/stock-out
     *
     * Consumes the oldest batches first. Availability is re-checked inside the
     * transaction, so a request that loses a race returns 422 with the real
     * remaining quantity rather than driving stock negative.
     */
    public function store(StockOutRequest $request): JsonResponse
    {
        /** @var Product $product */
        $product = Product::query()->findOrFail($request->integer('product_id'));

        $this->authorize('inventory.stock-out', $product);

        $movement = $this->inventory->stockOut(
            StockOutData::fromValidated($request->validated()),
            $request->user(),
        );

        return (new StockMovementResource($movement->load(['product', 'allocations.batch', 'creator'])))
            ->additional(['message' => 'Stock out recorded.'])
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/stock-out/preview
     *
     * Shows which batches a withdrawal would consume, without writing anything.
     * Powers the FIFO preview panel so the user can see the consequence before
     * committing.
     */
    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000000'],
        ]);

        /** @var Product $product */
        $product = Product::query()->findOrFail((int) $validated['product_id']);

        $this->authorize('inventory.stock-out', $product);

        return new JsonResponse([
            'data' => $this->inventory->previewFifo($product, (int) $validated['quantity']),
        ]);
    }
}
