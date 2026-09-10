<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Data\StockAdjustmentData;
use App\Data\StockInData;
use App\Data\StockOutData;
use App\Exceptions\ImmutableRecordException;
use App\Models\AuditLog;
use App\Models\InventoryLedgerEntry;
use App\Models\Product;
use App\Services\Inventory\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * History must stay traceable: neither the inventory ledger nor the audit log
 * may be silently rewritten.
 */
final class LedgerImmutabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_ledger_entry_cannot_be_updated(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            app(InventoryService::class)->stockIn(new StockInData($product->id, 10), $owner);

            $entry = InventoryLedgerEntry::query()->where('product_id', $product->id)->sole();

            $this->expectException(ImmutableRecordException::class);
            $entry->update(['quantity_change' => 9999]);
        });
    }

    public function test_a_ledger_entry_cannot_be_deleted(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            app(InventoryService::class)->stockIn(new StockInData($product->id, 10), $owner);

            $entry = InventoryLedgerEntry::query()->where('product_id', $product->id)->sole();

            $this->expectException(ImmutableRecordException::class);
            $entry->delete();
        });
    }

    public function test_an_audit_log_entry_cannot_be_modified(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            app(InventoryService::class)->stockIn(new StockInData($product->id, 10), $owner);

            $log = AuditLog::query()->latest('id')->firstOrFail();

            $this->expectException(ImmutableRecordException::class);
            $log->update(['description' => 'Rewritten history']);
        });
    }

    public function test_no_api_route_exposes_a_write_to_the_audit_log(): void
    {
        ['owner' => $owner] = $this->createBusinessWithOwner();

        // The collection route exists but accepts GET only...
        $this->actingAsApi($owner)->postJson('/api/v1/audit-logs', [])->assertStatus(405);
        // ...and there is no member route at all, so no update or delete path.
        $this->actingAsApi($owner)->deleteJson('/api/v1/audit-logs/1')->assertNotFound();
        $this->actingAsApi($owner)->patchJson('/api/v1/audit-logs/1', [])->assertNotFound();
    }

    public function test_the_running_balance_stays_consistent_across_many_movements(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();

        $this->asTenant($business, function () use ($business, $owner): void {
            $product = Product::factory()->forBusiness($business)->create();
            $service = app(InventoryService::class);

            $service->stockIn(new StockInData($product->id, 100), $owner);
            $service->stockOut(new StockOutData($product->id, 30), $owner);
            $service->stockIn(new StockInData($product->id, 50), $owner);
            $service->stockOut(new StockOutData($product->id, 45), $owner);
            $service->adjust(new StockAdjustmentData($product->id, -5, 'Breakage'), $owner);

            // 100 - 30 + 50 - 45 - 5 = 70
            $this->assertSame(70, $product->fresh()->quantity_on_hand);
            $this->assertSame(70, $service->availableQuantity($product->fresh()));

            // The last ledger line's balance matches, and replaying every signed
            // change from zero arrives at the same number.
            $entries = InventoryLedgerEntry::query()
                ->where('product_id', $product->id)
                ->chronological()
                ->get();

            $this->assertSame(70, $entries->last()->balance_after);
            $this->assertSame(70, (int) $entries->sum('quantity_change'));
        });
    }
}
