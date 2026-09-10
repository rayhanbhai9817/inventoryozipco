<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Data\StockInData;
use App\Enums\MovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StockInRequest;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Services\Inventory\InventoryService;
use App\Services\Reports\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

final class StockInController extends Controller
{
    public function __construct(private readonly InventoryService $inventory) {}

    /**
     * GET /api/v1/stock-in — the stock receipt history.
     */
    public function index(ReportFilterRequest $request, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('inventory.view');

        $movements = $reports->movements($request->filters(), MovementType::StockIn);

        return StockMovementResource::collection($movements)->additional([
            'meta' => ['totals' => $reports->movementTotals($request->filters(), MovementType::StockIn)],
        ]);
    }

    /**
     * POST /api/v1/stock-in
     *
     * Opens a new FIFO batch and increases the product's quantity. All of it
     * happens inside one transaction in the inventory service.
     */
    public function store(StockInRequest $request): JsonResponse
    {
        /** @var Product $product */
        $product = Product::query()->findOrFail($request->integer('product_id'));

        $this->authorize('inventory.stock-in', $product);

        $movement = $this->inventory->stockIn(
            StockInData::fromValidated($request->validated()),
            $request->user(),
        );

        return (new StockMovementResource($movement->load(['product', 'supplier', 'batch', 'creator'])))
            ->additional(['message' => 'Stock in recorded.'])
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
