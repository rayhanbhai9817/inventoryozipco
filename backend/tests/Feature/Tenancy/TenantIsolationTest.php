<?php

declare(strict_types=1);

namespace Tests\Feature\Tenancy;

use App\Data\StockInData;
use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tenant isolation: the rule that Tenant A can never reach Tenant B's data.
 *
 * Asserted at the query layer (the global scope), at the HTTP layer (route model
 * binding and validation), and at the write layer (the inventory service).
 */
final class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_queries_only_return_the_current_tenants_records(): void
    {
        ['business' => $alpha] = $this->createBusinessWithOwner(['name' => 'Alpha Supply']);
        ['business' => $beta] = $this->createBusinessWithOwner(['name' => 'Beta Trading']);

        Product::factory()->forBusiness($alpha)->count(3)->create();
        Product::factory()->forBusiness($beta)->count(5)->create();

        $this->asTenant($alpha, function (): void {
            $this->assertSame(3, Product::query()->count());
        });

        $this->asTenant($beta, function (): void {
            $this->assertSame(5, Product::query()->count());
        });
    }

    public function test_a_product_from_another_business_is_not_findable(): void
    {
        ['business' => $alpha] = $this->createBusinessWithOwner();
        ['business' => $beta] = $this->createBusinessWithOwner();

        $betaProduct = Product::factory()->forBusiness($beta)->create();

        $this->asTenant($alpha, function () use ($betaProduct): void {
            $this->assertNull(Product::query()->find($betaProduct->id));
        });
    }

    public function test_new_records_are_stamped_with_the_current_tenant(): void
    {
        ['business' => $alpha] = $this->createBusinessWithOwner();

        $this->asTenant($alpha, function () use ($alpha): void {
            $category = Category::create(['name' => 'Fasteners']);

            $this->assertSame($alpha->id, $category->business_id);
        });
    }

    public function test_queries_fail_closed_when_no_tenant_is_resolved(): void
    {
        ['business' => $alpha] = $this->createBusinessWithOwner();
        Product::factory()->forBusiness($alpha)->count(4)->create();

        // No tenant context: the scope must return nothing rather than
        // everything.
        $this->assertSame(0, Product::query()->count());
    }

    public function test_the_api_returns_404_for_another_businesses_product(): void
    {
        ['business' => $alpha, 'owner' => $alphaOwner] = $this->createBusinessWithOwner();
        ['business' => $beta] = $this->createBusinessWithOwner();

        $betaProduct = Product::factory()->forBusiness($beta)->create();

        $this->actingAsApi($alphaOwner)
            ->getJson("/api/v1/products/{$betaProduct->id}")
            ->assertNotFound();
    }

    public function test_the_api_index_never_lists_another_businesses_products(): void
    {
        ['business' => $alpha, 'owner' => $alphaOwner] = $this->createBusinessWithOwner();
        ['business' => $beta] = $this->createBusinessWithOwner();

        $mine = Product::factory()->forBusiness($alpha)->create(['name' => 'My Widget']);
        $theirs = Product::factory()->forBusiness($beta)->create(['name' => 'Their Widget']);

        $response = $this->actingAsApi($alphaOwner)->getJson('/api/v1/products')->assertOk();

        $ids = array_column($response->json('data'), 'id');

        $this->assertContains($mine->id, $ids);
        $this->assertNotContains($theirs->id, $ids);
    }

    public function test_stock_in_is_rejected_for_a_product_in_another_business(): void
    {
        ['owner' => $alphaOwner] = $this->createBusinessWithOwner();
        ['business' => $beta] = $this->createBusinessWithOwner();

        $betaProduct = Product::factory()->forBusiness($beta)->create();

        // The tenant-scoped `exists` rule rejects the foreign id at validation,
        // before any service code runs.
        $this->actingAsApi($alphaOwner)
            ->postJson('/api/v1/stock-in', [
                'product_id' => $betaProduct->id,
                'quantity' => 10,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product_id');

        $this->assertSame(0, $betaProduct->fresh()->quantity_on_hand);
    }

    public function test_a_supplier_cannot_be_linked_across_businesses(): void
    {
        ['business' => $alpha, 'owner' => $alphaOwner] = $this->createBusinessWithOwner();
        ['business' => $beta] = $this->createBusinessWithOwner();

        $alphaProduct = Product::factory()->forBusiness($alpha)->create();
        $betaSupplier = Supplier::factory()->forBusiness($beta)->create();

        $this->actingAsApi($alphaOwner)
            ->putJson("/api/v1/products/{$alphaProduct->id}/suppliers", [
                'supplier_ids' => [$betaSupplier->id],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('supplier_ids.0');
    }

    public function test_the_ledger_of_one_business_is_invisible_to_another(): void
    {
        ['business' => $alpha, 'owner' => $alphaOwner] = $this->createBusinessWithOwner();
        ['business' => $beta, 'owner' => $betaOwner] = $this->createBusinessWithOwner();

        $this->asTenant($alpha, function () use ($alpha, $alphaOwner): void {
            $product = Product::factory()->forBusiness($alpha)->create();
            app(InventoryService::class)->stockIn(new StockInData($product->id, 25), $alphaOwner);
        });

        // Beta's ledger is empty even though Alpha's has an entry.
        $this->actingAsApi($betaOwner)
            ->getJson('/api/v1/inventory/ledger')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAsApi($alphaOwner)
            ->getJson('/api/v1/inventory/ledger')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    /**
     * Regression: route model binding runs inside the middleware pipeline, so the
     * tenant scope has to be active before it executes. When the ordering is
     * wrong, every `/{id}` route 404s for its own tenant — a silent failure that
     * no unit test on the scope itself would catch.
     */
    public function test_scoped_route_bindings_resolve_records_in_the_current_tenant(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $product = Product::factory()->forBusiness($business)->create();
        $supplier = Supplier::factory()->forBusiness($business)->create();
        $category = Category::factory()->forBusiness($business)->create();

        $this->actingAsApi($owner)->getJson("/api/v1/products/{$product->id}")->assertOk();
        $this->actingAsApi($owner)->getJson("/api/v1/suppliers/{$supplier->id}")->assertOk();
        $this->actingAsApi($owner)->getJson("/api/v1/categories/{$category->id}")->assertOk();
        $this->actingAsApi($owner)->getJson("/api/v1/users/{$owner->id}")->assertOk();
        $this->actingAsApi($owner)->getJson("/api/v1/products/{$product->id}/batches")->assertOk();
    }

    public function test_a_user_from_another_business_is_not_resolvable_by_id(): void
    {
        ['owner' => $alphaOwner] = $this->createBusinessWithOwner();
        ['owner' => $betaOwner] = $this->createBusinessWithOwner();

        // 404 rather than 403, so the endpoint does not confirm that an account
        // exists elsewhere on the platform.
        $this->actingAsApi($alphaOwner)
            ->getJson("/api/v1/users/{$betaOwner->id}")
            ->assertNotFound();
    }

    public function test_a_deactivated_user_cannot_use_the_api(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();

        $staff = User::factory()->staff()->forBusiness($business)->inactive()->create();

        $this->actingAsApi($staff)
            ->getJson('/api/v1/dashboard')
            ->assertForbidden();
    }

    public function test_a_user_of_a_suspended_business_cannot_use_the_api(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();
        $business->forceFill(['is_active' => false])->save();

        $this->actingAsApi($owner->fresh())
            ->getJson('/api/v1/dashboard')
            ->assertForbidden();
    }
}
