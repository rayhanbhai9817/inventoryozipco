<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Products\StoreProductRequest;
use App\Http\Requests\Products\UpdateProductRequest;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Http\Resources\LedgerEntryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\StockBatchResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Product;
use App\Services\Audit\AuditLogger;
use App\Services\Notifications\NotificationService;
use App\Services\Reports\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ProductController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * GET /api/v1/products
     */
    public function index(ReportFilterRequest $request, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Product::class);

        $products = $reports->inventorySummary($request->filters());

        return ProductResource::collection($products)->additional([
            'meta' => ['totals' => $reports->inventoryTotals($request->filters())],
        ]);
    }

    /**
     * POST /api/v1/products
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $this->authorize('create', Product::class);

        $product = DB::transaction(function () use ($request): Product {
            $attributes = $request->productAttributes();

            if ($request->hasFile('image')) {
                $attributes['image_path'] = $request->file('image')->store('products', 'public');
            }

            $attributes['created_by'] = $request->user()->id;

            /** @var Product $product */
            $product = Product::create($attributes);

            $supplierIds = $request->supplierIds();

            if ($supplierIds !== []) {
                $product->suppliers()->sync($this->pivotPayload($supplierIds, $product));
            }

            $this->audit->log(
                action: AuditAction::ProductCreated,
                description: sprintf('Created product %s (%s)', $product->name, $product->sku),
                auditable: $product,
                newValues: $product->only(['sku', 'name', 'unit', 'minimum_stock_level', 'category_id']),
            );

            return $product;
        });

        // Nudge the user if the new product is missing reference data.
        $this->notifications->flagMissingReferenceData($product);

        return (new ProductResource($product->fresh(['category', 'suppliers', 'price'])))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/products/{product}
     */
    public function show(Product $product): ProductResource
    {
        $this->authorize('view', $product);

        $product->load([
            'category',
            'suppliers',
            'price.history',
            'openBatches.supplier',
            'creator',
        ])->loadCount(['stockBatches', 'stockMovements']);

        return new ProductResource($product);
    }

    /**
     * PATCH /api/v1/products/{product}
     */
    public function update(UpdateProductRequest $request, Product $product): ProductResource
    {
        $this->authorize('update', $product);

        DB::transaction(function () use ($request, $product): void {
            $attributes = $request->productAttributes();

            if ($request->hasFile('image')) {
                $attributes['image_path'] = $request->file('image')->store('products', 'public');
            } elseif ($request->boolean('remove_image')) {
                $attributes['image_path'] = null;
            }

            $product->fill($attributes);

            if ($product->isDirty()) {
                $product->save();

                $this->audit->logModelChange(
                    action: AuditAction::ProductUpdated,
                    model: $product,
                    description: sprintf('Updated product %s (%s)', $product->name, $product->sku),
                );
            }
        });

        return new ProductResource($product->fresh(['category', 'suppliers', 'price']));
    }

    /**
     * POST /api/v1/products/{product}/archive
     *
     * Archiving is the normal retirement path: the product disappears from
     * pickers and no new movement can be recorded against it, while its ledger
     * history stays intact and reportable.
     */
    public function archive(Product $product): ProductResource
    {
        $this->authorize('archive', $product);

        $product->forceFill(['is_active' => false, 'archived_at' => now()])->save();

        $this->audit->log(
            action: AuditAction::ProductArchived,
            description: sprintf('Archived product %s (%s)', $product->name, $product->sku),
            auditable: $product,
        );

        return new ProductResource($product->fresh(['category']));
    }

    /**
     * POST /api/v1/products/{product}/restore
     */
    public function restore(Product $product): ProductResource
    {
        $this->authorize('restore', $product);

        $product->forceFill(['is_active' => true, 'archived_at' => null])->save();

        $this->audit->log(
            action: AuditAction::ProductRestored,
            description: sprintf('Restored product %s (%s)', $product->name, $product->sku),
            auditable: $product,
        );

        return new ProductResource($product->fresh(['category']));
    }

    /**
     * DELETE /api/v1/products/{product}
     *
     * Only permitted for a product with no movement history — the policy
     * enforces it. Anything that has moved must be archived instead so the ledger
     * keeps referring to a real product.
     */
    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);

        $snapshot = $product->only(['sku', 'name']);
        $product->delete();

        $this->audit->log(
            action: AuditAction::ProductDeleted,
            description: sprintf('Deleted product %s (%s)', $snapshot['name'], $snapshot['sku']),
            oldValues: $snapshot,
        );

        return new JsonResponse(['message' => 'Product deleted.']);
    }

    /**
     * GET /api/v1/products/{product}/ledger
     */
    public function ledger(ReportFilterRequest $request, Product $product, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('view', $product);

        $entries = $reports->ledger($request->filters() + ['product_id' => $product->id]);

        return LedgerEntryResource::collection($entries);
    }

    /**
     * GET /api/v1/products/{product}/movements
     */
    public function movements(ReportFilterRequest $request, Product $product, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('view', $product);

        $movements = $reports->movements(
            $request->filters() + ['product_id' => $product->id],
            $request->movementType(),
        );

        return StockMovementResource::collection($movements);
    }

    /**
     * GET /api/v1/products/{product}/batches
     */
    public function batches(Request $request, Product $product): AnonymousResourceCollection
    {
        $this->authorize('view', $product);

        $batches = $product->stockBatches()
            ->with(['supplier:id,name', 'creator:id,name'])
            ->when(
                $request->boolean('open_only'),
                fn ($query) => $query->open()
            )
            ->orderBy('received_at')
            ->orderBy('id')
            ->paginate(min(max((int) $request->integer('per_page', 25), 5), 100));

        return StockBatchResource::collection($batches);
    }

    /**
     * PUT /api/v1/products/{product}/suppliers
     *
     * Replaces the product's supplier links. Many-to-many in both directions:
     * a product can have several suppliers and a supplier several products.
     */
    public function syncSuppliers(Request $request, Product $product): ProductResource
    {
        $this->authorize('manageSuppliers', $product);

        $validated = $request->validate([
            'supplier_ids' => ['present', 'array', 'max:50'],
            'supplier_ids.*' => [
                'integer',
                Rule::exists('suppliers', 'id')
                    ->where('business_id', $product->business_id)
                    ->whereNull('deleted_at'),
            ],
            'preferred_supplier_id' => ['nullable', 'integer'],
        ], [
            'supplier_ids.*.exists' => 'One of the selected suppliers does not belong to your business.',
        ]);

        $supplierIds = array_map('intval', $validated['supplier_ids']);

        $product->suppliers()->sync($this->pivotPayload(
            $supplierIds,
            $product,
            isset($validated['preferred_supplier_id']) ? (int) $validated['preferred_supplier_id'] : null,
        ));

        $this->audit->log(
            action: AuditAction::SupplierLinkedToProduct,
            description: sprintf('Updated suppliers for %s (%s)', $product->name, $product->sku),
            auditable: $product,
            newValues: ['supplier_ids' => $supplierIds],
        );

        return new ProductResource($product->fresh(['suppliers', 'category', 'price']));
    }

    /**
     * Build the pivot payload, stamping `business_id` so the relationship row is
     * tenant-scoped like everything else.
     *
     * @param  array<int, int>  $supplierIds
     * @return array<int, array<string, mixed>>
     */
    private function pivotPayload(array $supplierIds, Product $product, ?int $preferredId = null): array
    {
        $payload = [];

        foreach ($supplierIds as $supplierId) {
            $payload[$supplierId] = [
                'business_id' => $product->business_id,
                'is_preferred' => $preferredId !== null && $preferredId === $supplierId,
            ];
        }

        return $payload;
    }
}
