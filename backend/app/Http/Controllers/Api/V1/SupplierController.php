<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Http\Requests\Suppliers\StoreSupplierRequest;
use App\Http\Resources\StockBatchResource;
use App\Http\Resources\StockMovementResource;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Services\Audit\AuditLogger;
use App\Services\Reports\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

final class SupplierController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * GET /api/v1/suppliers
     */
    public function index(ReportFilterRequest $request, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Supplier::class);

        return SupplierResource::collection($reports->suppliers($request->filters()));
    }

    /**
     * POST /api/v1/suppliers
     */
    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $this->authorize('create', Supplier::class);

        $supplier = DB::transaction(function () use ($request): Supplier {
            /** @var Supplier $supplier */
            $supplier = Supplier::create($request->supplierAttributes());

            $productIds = $request->productIds();

            if ($productIds !== null && $productIds !== []) {
                $supplier->products()->sync($this->pivotPayload($productIds, $supplier));
            }

            $this->audit->log(
                action: AuditAction::SupplierCreated,
                description: sprintf('Created supplier "%s"', $supplier->name),
                auditable: $supplier,
                newValues: $supplier->only(['name', 'code', 'email', 'phone', 'is_active']),
            );

            return $supplier;
        });

        return (new SupplierResource($supplier->fresh()->loadCount('products')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/suppliers/{supplier}
     */
    public function show(Supplier $supplier): SupplierResource
    {
        $this->authorize('view', $supplier);

        $supplier->load(['products.category'])
            ->loadCount('products')
            ->loadCount('stockBatches as batches_count')
            ->loadSum('stockBatches as units_supplied', 'quantity_received');

        return new SupplierResource($supplier);
    }

    /**
     * PATCH /api/v1/suppliers/{supplier}
     */
    public function update(StoreSupplierRequest $request, Supplier $supplier): SupplierResource
    {
        $this->authorize('update', $supplier);

        DB::transaction(function () use ($request, $supplier): void {
            $supplier->fill($request->supplierAttributes());

            if ($supplier->isDirty()) {
                $supplier->save();

                $this->audit->logModelChange(
                    action: AuditAction::SupplierUpdated,
                    model: $supplier,
                    description: sprintf('Updated supplier "%s"', $supplier->name),
                );
            }

            $productIds = $request->productIds();

            if ($productIds !== null) {
                $supplier->products()->sync($this->pivotPayload($productIds, $supplier));
            }
        });

        return new SupplierResource($supplier->fresh()->loadCount('products'));
    }

    /**
     * DELETE /api/v1/suppliers/{supplier}
     *
     * The policy refuses this once the supplier has supplied any batch, because
     * those batches must keep pointing at a real supplier. Deactivate instead.
     */
    public function destroy(Supplier $supplier): JsonResponse
    {
        $this->authorize('delete', $supplier);

        $name = $supplier->name;
        $supplier->delete();

        $this->audit->log(
            action: AuditAction::SupplierArchived,
            description: sprintf('Deleted supplier "%s"', $name),
            oldValues: ['name' => $name],
        );

        return new JsonResponse(['message' => 'Supplier deleted.']);
    }

    /**
     * POST /api/v1/suppliers/{supplier}/toggle-active
     */
    public function toggleActive(Supplier $supplier): SupplierResource
    {
        $this->authorize('update', $supplier);

        $supplier->forceFill(['is_active' => ! $supplier->is_active])->save();

        $this->audit->log(
            action: AuditAction::SupplierUpdated,
            description: sprintf(
                '%s supplier "%s"',
                $supplier->is_active ? 'Activated' : 'Deactivated',
                $supplier->name
            ),
            auditable: $supplier,
            newValues: ['is_active' => $supplier->is_active],
        );

        return new SupplierResource($supplier->loadCount('products'));
    }

    /**
     * GET /api/v1/suppliers/{supplier}/batches
     */
    public function batches(ReportFilterRequest $request, Supplier $supplier): AnonymousResourceCollection
    {
        $this->authorize('view', $supplier);

        $filters = $request->filters();

        $batches = $supplier->stockBatches()
            ->with(['product:id,name,sku,unit,category_id', 'creator:id,name'])
            ->when(
                isset($filters['product_id']),
                fn ($query) => $query->where('product_id', $filters['product_id'])
            )
            ->when(
                isset($filters['date_from']),
                fn ($query) => $query->where('received_at', '>=', $filters['date_from'].' 00:00:00')
            )
            ->when(
                isset($filters['date_to']),
                fn ($query) => $query->where('received_at', '<=', $filters['date_to'].' 23:59:59')
            )
            ->latest('received_at')
            ->paginate((int) ($filters['per_page'] ?? 25));

        return StockBatchResource::collection($batches);
    }

    /**
     * GET /api/v1/suppliers/{supplier}/movements — the supplier's stock IN history.
     */
    public function movements(ReportFilterRequest $request, Supplier $supplier, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('view', $supplier);

        $movements = $reports->movements(
            $request->filters() + ['supplier_id' => $supplier->id],
            $request->movementType(),
        );

        return StockMovementResource::collection($movements);
    }

    /**
     * @param  array<int, int>  $productIds
     * @return array<int, array<string, mixed>>
     */
    private function pivotPayload(array $productIds, Supplier $supplier): array
    {
        $payload = [];

        foreach ($productIds as $productId) {
            $payload[$productId] = ['business_id' => $supplier->business_id];
        }

        return $payload;
    }
}
