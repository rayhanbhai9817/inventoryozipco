<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Business;
use App\Models\Product;
use App\Services\Inventory\InventoryService;
use App\Support\TenantContext;
use Illuminate\Console\Command;

/**
 * Recomputes every product's denormalised `quantity_on_hand` from its batch rows.
 *
 * The application maintains the cache transactionally, so this should never find
 * a discrepancy. It exists as an operational safety net and a verification tool:
 * run it after a restore, a manual data fix, or a suspected incident.
 */
final class ReconcileInventory extends Command
{
    protected $signature = 'inventory:reconcile
                            {--business= : Limit to one business id}
                            {--dry-run : Report discrepancies without writing}';

    protected $description = 'Recompute product quantities from stock batches and report any drift';

    public function handle(InventoryService $inventory): int
    {
        $businesses = Business::query()
            ->when($this->option('business'), fn ($query, $id) => $query->whereKey($id))
            ->get();

        if ($businesses->isEmpty()) {
            $this->warn('No businesses found.');

            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');
        $discrepancies = 0;
        $checked = 0;

        foreach ($businesses as $business) {
            TenantContext::forBusiness($business, function () use ($business, $inventory, $dryRun, &$discrepancies, &$checked): void {
                Product::query()->chunkById(200, function ($products) use ($business, $inventory, $dryRun, &$discrepancies, &$checked): void {
                    foreach ($products as $product) {
                        $checked++;
                        $cached = $product->quantity_on_hand;
                        $actual = $inventory->availableQuantity($product);

                        if ($cached === $actual) {
                            continue;
                        }

                        $discrepancies++;

                        $this->warn(sprintf(
                            '[%s] %s (%s): cached %d, batches total %d%s',
                            $business->name,
                            $product->name,
                            $product->sku,
                            $cached,
                            $actual,
                            $dryRun ? ' — not corrected (dry run)' : ' — corrected',
                        ));

                        if (! $dryRun) {
                            $inventory->reconcile($product);
                        }
                    }
                });
            });
        }

        $this->newLine();
        $this->info(sprintf(
            'Checked %d products across %d business(es). %s',
            $checked,
            $businesses->count(),
            $discrepancies === 0
                ? 'No discrepancies found.'
                : sprintf('%d discrepanc%s %s.', $discrepancies, $discrepancies === 1 ? 'y' : 'ies', $dryRun ? 'reported' : 'corrected'),
        ));

        // A non-zero exit on a dry run makes this usable as a monitoring check.
        return $dryRun && $discrepancies > 0 ? self::FAILURE : self::SUCCESS;
    }
}
