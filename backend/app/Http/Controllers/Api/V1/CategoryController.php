<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Categories\StoreCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

final class CategoryController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * GET /api/v1/categories
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Category::class);

        $categories = Category::query()
            ->search($request->string('search')->value())
            ->when(
                $request->has('is_active'),
                fn ($query) => $query->where('is_active', $request->boolean('is_active'))
            )
            ->withCount('products')
            ->withSum('products as products_sum_quantity_on_hand', 'quantity_on_hand')
            ->orderBy('name')
            ->paginate(min(max((int) $request->integer('per_page', 50), 5), 200))
            ->withQueryString();

        return CategoryResource::collection($categories);
    }

    /**
     * POST /api/v1/categories
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $this->authorize('create', Category::class);

        /** @var Category $category */
        $category = Category::create($request->validated());

        $this->audit->log(
            action: AuditAction::CategoryCreated,
            description: sprintf('Created category "%s"', $category->name),
            auditable: $category,
            newValues: $category->only(['name', 'color', 'is_active']),
        );

        return (new CategoryResource($category->fresh()->loadCount('products')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/categories/{category}
     */
    public function show(Category $category): CategoryResource
    {
        $this->authorize('view', $category);

        return new CategoryResource(
            $category->loadCount('products')
                ->loadSum('products as products_sum_quantity_on_hand', 'quantity_on_hand')
        );
    }

    /**
     * PATCH /api/v1/categories/{category}
     */
    public function update(StoreCategoryRequest $request, Category $category): CategoryResource
    {
        $this->authorize('update', $category);

        $category->fill($request->validated());

        if ($category->isDirty()) {
            $category->save();

            $this->audit->logModelChange(
                action: AuditAction::CategoryUpdated,
                model: $category,
                description: sprintf('Updated category "%s"', $category->name),
            );
        }

        return new CategoryResource($category->loadCount('products'));
    }

    /**
     * DELETE /api/v1/categories/{category}
     *
     * Refused by the policy while products still reference the category —
     * deactivate it instead so existing products keep a valid category.
     */
    public function destroy(Category $category): JsonResponse
    {
        $this->authorize('delete', $category);

        $name = $category->name;
        $category->delete();

        $this->audit->log(
            action: AuditAction::CategoryDeleted,
            description: sprintf('Deleted category "%s"', $name),
            oldValues: ['name' => $name],
        );

        return new JsonResponse(['message' => 'Category deleted.']);
    }

    /**
     * POST /api/v1/categories/{category}/archive
     */
    public function archive(Category $category): CategoryResource
    {
        $this->authorize('update', $category);

        $category->forceFill(['is_active' => false])->save();

        $this->audit->log(
            action: AuditAction::CategoryArchived,
            description: sprintf('Deactivated category "%s"', $category->name),
            auditable: $category,
        );

        return new CategoryResource($category->loadCount('products'));
    }
}
