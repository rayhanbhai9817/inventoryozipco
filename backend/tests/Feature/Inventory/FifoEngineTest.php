<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Data\StockAdjustmentData;
use App\Data\StockInData;
use App\Data\StockOutData;
use App\Enums\MovementType;
use App\Exceptions\InsufficientStockException;
use App\Models\InventoryLedgerEntry;
use App\Models\Product;
use App\Models\StockBatch;
use App\Models\Supplier;
use App\Services\Inventory\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The FIFO engine and the non-negotiable inventory rules.
 *
 * These tests exercise the service directly so they assert the business logic
 * itself, not merely the HTTP surface in front of it.
 */
final class FifoEngineTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_in_opens_a_batch_and_increases_quantity(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $supplier = Supplier::factory()->forBusiness($business)->create();

            $movement = app(InventoryService::class)->stockIn(
                new StockInData(
                    productId: $product->id,
                    quantity: 40,
                    supplierId: $supplier->id,
                    reference: 'PO-1001',
                    unitCost: '12.5000',
                ),
                $owner,
            );

            $this->assertSame(MovementType::StockIn, $movement->type);
            $this->assertSame(40, $movement->quantity);
            $this->assertSame(40, $movement->balance_after);
            $this->assertSame(40, $product->fresh()->quantity_on_hand);

            $batch = StockBatch::query()->where('product_id', $product->id)->sole();
            $this->assertSame(40, $batch->quantity_received);
            $this->assertSame(40, $batch->quantity_remaining);
            $this->assertSame($supplier->id, $batch->supplier_id);

            // One ledger line, carrying the running balance.
            $entry = InventoryLedgerEntry::query()->where('product_id', $product->id)->sole();
            $this->assertSame(40, $entry->quantity_change);
            $this->assertSame(40, $entry->balance_after);
        });
    }

    public function test_stock_out_consumes_the_oldest_batch_first(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            // Three receipts, oldest first.
            $service->stockIn(new StockInData($product->id, 10, receivedAt: Carbon::parse('2026-01-01 09:00')), $owner);
            $service->stockIn(new StockInData($product->id, 20, receivedAt: Carbon::parse('2026-02-01 09:00')), $owner);
            $service->stockIn(new StockInData($product->id, 30, receivedAt: Carbon::parse('2026-03-01 09:00')), $owner);

            $this->assertSame(60, $product->fresh()->quantity_on_hand);

            // Take 25: should empty the 10 batch, then take 15 from the 20 batch,
            // leaving the 30 batch untouched.
            $movement = $service->stockOut(new StockOutData($product->id, 25, reference: 'SO-5001'), $owner);

            $this->assertSame(35, $movement->balance_after);
            $this->assertSame(35, $product->fresh()->quantity_on_hand);

            $batches = StockBatch::query()
                ->where('product_id', $product->id)
                ->orderBy('received_at')
                ->get();

            $this->assertSame([0, 5, 30], $batches->pluck('quantity_remaining')->map('intval')->all());

            // Allocations record exactly which batches were consumed.
            $allocations = $movement->allocations()->orderBy('id')->get();
            $this->assertCount(2, $allocations);
            $this->assertSame($batches[0]->id, $allocations[0]->stock_batch_id);
            $this->assertSame(10, $allocations[0]->quantity);
            $this->assertSame($batches[1]->id, $allocations[1]->stock_batch_id);
            $this->assertSame(15, $allocations[1]->quantity);
        });
    }

    public function test_stock_out_writes_one_ledger_line_per_batch_with_a_descending_balance(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 10, receivedAt: Carbon::parse('2026-01-01 09:00')), $owner);
            $service->stockIn(new StockInData($product->id, 10, receivedAt: Carbon::parse('2026-01-02 09:00')), $owner);

            $movement = $service->stockOut(new StockOutData($product->id, 15), $owner);

            $lines = InventoryLedgerEntry::query()
                ->where('stock_movement_id', $movement->id)
                ->orderBy('id')
                ->get();

            $this->assertCount(2, $lines);
            // 20 → 10 (first batch emptied) → 5 (second batch partially used).
            $this->assertSame(-10, $lines[0]->quantity_change);
            $this->assertSame(10, $lines[0]->balance_after);
            $this->assertSame(-5, $lines[1]->quantity_change);
            $this->assertSame(5, $lines[1]->balance_after);
            $this->assertTrue((bool) $lines[0]->meta['fifo']);
        });
    }

    public function test_stock_out_is_refused_when_it_would_drive_quantity_negative(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 5), $owner);

            try {
                $service->stockOut(new StockOutData($product->id, 6), $owner);
                $this->fail('Expected InsufficientStockException to be thrown.');
            } catch (InsufficientStockException $e) {
                $this->assertSame(6, $e->requested);
                $this->assertSame(5, $e->available);
            }

            // The failed attempt changed nothing: no movement, no ledger line,
            // and the batch is untouched.
            $this->assertSame(5, $product->fresh()->quantity_on_hand);
            $this->assertSame(1, InventoryLedgerEntry::query()->where('product_id', $product->id)->count());
            $this->assertSame(5, (int) StockBatch::query()->where('product_id', $product->id)->sole()->quantity_remaining);
        });
    }

    public function test_stock_out_of_the_exact_available_quantity_empties_the_product(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 7), $owner);
            $service->stockOut(new StockOutData($product->id, 7), $owner);

            $this->assertSame(0, $product->fresh()->quantity_on_hand);
            $this->assertSame(0, (int) StockBatch::query()->where('product_id', $product->id)->sole()->quantity_remaining);
            $this->assertSame(0, $service->availableQuantity($product->fresh()));
        });
    }

    public function test_positive_adjustment_opens_a_batch_at_the_end_of_the_fifo_queue(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 5, receivedAt: Carbon::parse('2026-01-01 09:00')), $owner);
            $service->adjust(new StockAdjustmentData($product->id, 3, 'Found during stock count'), $owner);

            $this->assertSame(8, $product->fresh()->quantity_on_hand);

            // The adjustment batch is newest, so the original batch is consumed first.
            $service->stockOut(new StockOutData($product->id, 6), $owner);

            $batches = StockBatch::query()
                ->where('product_id', $product->id)
                ->orderBy('received_at')
                ->orderBy('id')
                ->get();

            $this->assertSame([0, 2], $batches->pluck('quantity_remaining')->map('intval')->all());
        });
    }

    public function test_negative_adjustment_consumes_fifo_and_cannot_go_below_zero(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 4, receivedAt: Carbon::parse('2026-01-01 09:00')), $owner);
            $service->stockIn(new StockInData($product->id, 4, receivedAt: Carbon::parse('2026-02-01 09:00')), $owner);

            $movement = $service->adjust(new StockAdjustmentData($product->id, -5, 'Damaged in transit'), $owner);

            $this->assertSame(MovementType::Adjustment, $movement->type);
            $this->assertSame(-1, $movement->direction);
            $this->assertSame(3, $movement->balance_after);
            $this->assertSame(3, $product->fresh()->quantity_on_hand);

            $this->expectException(InsufficientStockException::class);
            $service->adjust(new StockAdjustmentData($product->id, -4, 'Too much'), $owner);
        });
    }

    public function test_an_adjustment_requires_a_non_zero_delta(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();

            $this->expectException(\InvalidArgumentException::class);
            app(InventoryService::class)->adjust(
                new StockAdjustmentData($product->id, 0, 'No change'),
                $owner
            );
        });
    }

    public function test_fifo_preview_reports_the_batches_a_withdrawal_would_consume_without_writing(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 6, receivedAt: Carbon::parse('2026-01-01 09:00')), $owner);
            $service->stockIn(new StockInData($product->id, 6, receivedAt: Carbon::parse('2026-02-01 09:00')), $owner);

            $preview = $service->previewFifo($product->fresh(), 8);

            $this->assertTrue($preview['sufficient']);
            $this->assertSame(12, $preview['available']);
            $this->assertCount(2, $preview['allocations']);
            $this->assertSame(6, $preview['allocations'][0]['quantity_taken']);
            $this->assertTrue($preview['allocations'][0]['depletes_batch']);
            $this->assertSame(2, $preview['allocations'][1]['quantity_taken']);
            $this->assertFalse($preview['allocations'][1]['depletes_batch']);

            // Nothing was written.
            $this->assertSame(12, $product->fresh()->quantity_on_hand);

            $insufficient = $service->previewFifo($product->fresh(), 99);
            $this->assertFalse($insufficient['sufficient']);
        });
    }

    public function test_a_failed_withdrawal_rolls_back_every_write_in_the_transaction(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 10), $owner);

            $movementsBefore = $product->stockMovements()->count();
            $ledgerBefore = InventoryLedgerEntry::query()->where('product_id', $product->id)->count();

            try {
                $service->stockOut(new StockOutData($product->id, 11), $owner);
            } catch (InsufficientStockException) {
                // expected
            }

            $this->assertSame($movementsBefore, $product->stockMovements()->count());
            $this->assertSame($ledgerBefore, InventoryLedgerEntry::query()->where('product_id', $product->id)->count());
        });
    }

    public function test_reconcile_repairs_a_drifted_quantity_cache(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 12), $owner);

            // Simulate drift by writing the cache column directly.
            Product::query()->whereKey($product->id)->update(['quantity_on_hand' => 999]);

            $this->assertSame(12, $service->reconcile($product->fresh()));
            $this->assertSame(12, $product->fresh()->quantity_on_hand);
        });
    }

    public function test_a_drifted_cache_cannot_authorise_a_withdrawal_the_batches_cannot_satisfy(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 5), $owner);

            // Cache claims far more stock than the batches hold.
            Product::query()->whereKey($product->id)->update(['quantity_on_hand' => 500]);

            $this->expectException(InsufficientStockException::class);
            $service->stockOut(new StockOutData($product->id, 50), $owner);
        });
    }
}
