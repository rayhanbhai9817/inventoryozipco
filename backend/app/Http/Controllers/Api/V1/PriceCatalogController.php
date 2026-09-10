<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Prices\StoreProductPriceRequest;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Http\Resources\ProductPriceHistoryResource;
use App\Http\Resources\ProductPriceResource;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Services\Pricing\PriceCatalogService;
use App\Services\Reports\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * The product price / reference catalogue.
 *
 * Completely separate from the inventory endpoints. Nothing here accepts or
 * returns a quantity, and the service it delegates to touches no inventory
 * table — reference pricing cannot move stock.
 */
final class PriceCatalogController extends Controller
{
    public function __construct(private readonly PriceCatalogService $prices) {}

    /**
     * GET /api/v1/price-catalog
     */
    public function index(ReportFilterRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ProductPrice::class);

        $filters = $request->filters();

        $prices = ProductPrice::query()
            ->with(['product:id,name,sku,unit,category_id', 'product.category', 'updatedBy:id,name'])
            ->search($filters['search'] ?? null)
            ->when(
                isset($filters['product_id']),
                fn ($query) => $query->where('product_id', $filters['product_id'])
            )
            ->when(
                isset($filters['category_id']),
                fn ($query) => $query->whereHas(
                    'product',
                    fn ($p) => $p->where('products.category_id', $filters['category_id'])
                )
            )
            ->orderByDesc('effective_from')
            ->paginate((int) ($filters['per_page'] ?? 25))
            ->withQueryString();

        return ProductPriceResource::collection($prices);
    }

    /**
     * POST /api/v1/price-catalog
     *
     * Upserts the reference price for a product and appends to its price history.
     */
    public function store(StoreProductPriceRequest $request): JsonResponse
    {
        $this->authorize('create', ProductPrice::class);

        /** @var Product $product */
        $product = Product::query()->findOrFail($request->integer('product_id'));

        $attributes = $request->safe()->except(['product_id', 'image']);

        if ($request->hasFile('image')) {
            $attributes['image_path'] = $request->file('image')->store('price-references', 'public');
        }

        $price = $this->prices->setPrice($product, $attributes, $request->user());

        return (new ProductPriceResource($price->load(['product', 'updatedBy'])))
            ->additional(['message' => 'Reference price saved.'])
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/price-catalog/{price}
     */
    public function show(ProductPrice $price): ProductPriceResource
    {
        $this->authorize('view', $price);

        return new ProductPriceResource($price->load(['product.category', 'updatedBy', 'history.recordedBy']));
    }

    /**
     * DELETE /api/v1/price-catalog/{price}
     *
     * Removes the current reference price. History is retained — it records what
     * the price was, and that remains true.
     */
    public function destroy(ProductPrice $price): JsonResponse
    {
        $this->authorize('delete', $price);

        $product = $price->product;

        if ($product !== null) {
            $this->prices->removePrice($product, request()->user());
        }

        return new JsonResponse(['message' => 'Reference price removed.']);
    }

    /**
     * GET /api/v1/price-catalog/products/{product}/history
     */
    public function history(ReportFilterRequest $request, Product $product, ReportService $reports): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ProductPrice::class);

        $history = $reports->priceHistory($request->filters() + ['product_id' => $product->id]);

        return ProductPriceHistoryResource::collection($history);
    }
}
