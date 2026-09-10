<?php

declare(strict_types=1);

namespace Tests\Feature\Pricing;

use App\Data\StockInData;
use App\Models\InventoryLedgerEntry;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductPriceHistory;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Services\Inventory\InventoryService;
use App\Services\Pricing\PriceCatalogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Reference pricing must remain completely separate from inventory quantity.
 *
 * These tests are the guardrail for rule 8 and 9: pricing data never affects
 * quantity, FIFO, or the ledger.
 */
final class PriceCatalogSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_setting_a_price_does_not_change_any_inventory_state(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();

            app(InventoryService::class)->stockIn(new StockInData($product->id, 30), $owner);

            $quantityBefore = $product->fresh()->quantity_on_hand;
            $batchesBefore = StockBatch::query()->where('product_id', $product->id)->get()
                ->map(fn (StockBatch $b): array => [$b->id, $b->quantity_remaining])->all();
            $ledgerBefore = InventoryLedgerEntry::query()->where('product_id', $product->id)->count();
            $movementsBefore = StockMovement::query()->where('product_id', $product->id)->count();

            app(PriceCatalogService::class)->setPrice($product, [
                'reference_price' => '49.9900',
                'currency' => 'USD',
                'source' => 'Supplier catalogue',
            ], $owner);

            // Price was recorded...
            $this->assertSame('49.9900', ProductPrice::query()->where('product_id', $product->id)->sole()->reference_price);

            // ...and nothing about inventory moved.
            $this->assertSame($quantityBefore, $product->fresh()->quantity_on_hand);
            $this->assertSame($ledgerBefore, InventoryLedgerEntry::query()->where('product_id', $product->id)->count());
            $this->assertSame($movementsBefore, StockMovement::query()->where('product_id', $product->id)->count());
            $this->assertSame(
                $batchesBefore,
                StockBatch::query()->where('product_id', $product->id)->get()
                    ->map(fn (StockBatch $b): array => [$b->id, $b->quantity_remaining])->all()
            );
        });
    }

    public function test_repeated_price_changes_build_a_history_with_one_open_window(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(PriceCatalogService::class);

            $service->setPrice($product, ['reference_price' => '10.0000', 'effective_from' => '2026-01-01'], $owner);
            $service->setPrice($product, ['reference_price' => '12.5000', 'effective_from' => '2026-03-01'], $owner);
            $service->setPrice($product, ['reference_price' => '11.0000', 'effective_from' => '2026-06-01'], $owner);

            $history = ProductPriceHistory::query()
                ->where('product_id', $product->id)
                ->orderBy('effective_from')
                ->get();

            $this->assertCount(3, $history);

            // Earlier windows are closed; exactly one is open.
            $this->assertSame('2026-03-01', $history[0]->effective_to?->toDateString());
            $this->assertSame('2026-06-01', $history[1]->effective_to?->toDateString());
            $this->assertNull($history[2]->effective_to);
            $this->assertSame(1, $history->whereNull('effective_to')->count());

            // Previous price is carried for change reporting.
            $this->assertSame('10.0000', $history[1]->previous_price);
            $this->assertSame(25.0, $history[1]->changePercentage());

            // The current row reflects the latest price.
            $this->assertSame('11.0000', ProductPrice::query()->where('product_id', $product->id)->sole()->reference_price);
        });
    }

    public function test_removing_a_price_keeps_the_history(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(PriceCatalogService::class);

            $service->setPrice($product, ['reference_price' => '20.0000'], $owner);
            $service->removePrice($product, $owner);

            $this->assertSame(0, ProductPrice::query()->where('product_id', $product->id)->count());
            $this->assertSame(1, ProductPriceHistory::query()->where('product_id', $product->id)->count());
        });
    }

    public function test_the_price_endpoint_rejects_a_negative_reference_price(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();
        $product = Product::factory()->forBusiness($business)->create();

        $this->actingAsApi($owner)
            ->postJson('/api/v1/price-catalog', [
                'product_id' => $product->id,
                'reference_price' => -5,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reference_price');
    }

    public function test_the_price_endpoint_ignores_any_attempt_to_pass_a_quantity(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();
        $product = Product::factory()->forBusiness($business)->create();

        $this->actingAsApi($owner)
            ->postJson('/api/v1/price-catalog', [
                'product_id' => $product->id,
                'reference_price' => '15.0000',
                // Not an accepted field; must have no effect whatsoever.
                'quantity_on_hand' => 9999,
                'quantity' => 500,
            ])
            ->assertCreated();

        $this->assertSame(0, $product->fresh()->quantity_on_hand);
    }
}
