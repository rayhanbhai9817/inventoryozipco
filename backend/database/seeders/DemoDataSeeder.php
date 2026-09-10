<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Data\StockInData;
use App\Data\StockOutData;
use App\Enums\Role;
use App\Models\Business;
use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use App\Services\Pricing\PriceCatalogService;
use App\Services\Tenancy\RoleProvisioner;
use App\Support\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Demo data for evaluating the application end to end.
 *
 * NOT part of `DatabaseSeeder` and refuses to run in production. Every quantity
 * it creates goes through the real inventory service, so the demo tenant's
 * batches, movements and ledger are genuinely consistent rather than fabricated.
 *
 *   php artisan db:seed --class=DemoDataSeeder
 */
final class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (App::isProduction() && ! (bool) env('ALLOW_DEMO_SEED', false)) {
            throw new RuntimeException(
                'DemoDataSeeder will not run in production. Set ALLOW_DEMO_SEED=true only if you genuinely want demo data in this environment.'
            );
        }

        app(RoleProvisioner::class)->syncPermissionCatalogue();

        TenantContext::unscoped(function (): void {
            $business = $this->createBusiness();

            app(RoleProvisioner::class)->provision($business);

            $owner = $this->createUsers($business);

            TenantContext::forBusiness($business, function () use ($business, $owner): void {
                $categories = $this->createCategories();
                $suppliers = $this->createSuppliers();
                $products = $this->createProducts($categories, $suppliers, $owner);
                $this->recordMovements($products, $suppliers, $owner);
                $this->recordPrices($products, $owner);

                $this->command?->info(sprintf(
                    'Demo tenant "%s" ready: %d products, %d suppliers, %d categories.',
                    $business->name,
                    $products->count(),
                    $suppliers->count(),
                    $categories->count(),
                ));
                $this->command?->info('Sign in as owner@fastsold.test / Demo-Password-42');
            });
        });
    }

    private function createBusiness(): Business
    {
        return Business::query()->updateOrCreate(
            ['slug' => 'fast-sold-demo'],
            [
                'name' => 'Fast Sold Demo Warehouse',
                'legal_name' => 'Fast Sold Demo Warehouse LLC',
                'contact_email' => 'hello@fastsold.test',
                'phone' => '+1-555-0142',
                'industry' => 'Wholesale distribution',
                'city' => 'Austin',
                'state' => 'TX',
                'country' => 'US',
                'timezone' => 'America/Chicago',
                'currency' => 'USD',
                'default_minimum_stock_level' => 10,
                'is_active' => true,
                'settings' => [
                    'notifications' => ['low_stock_enabled' => true, 'out_of_stock_enabled' => true],
                ],
            ],
        );
    }

    private function createUsers(Business $business): User
    {
        $owner = User::query()->updateOrCreate(
            ['email' => 'owner@fastsold.test'],
            [
                'business_id' => $business->id,
                'name' => 'Dana Okonkwo',
                'password' => 'Demo-Password-42',
                'role' => Role::Owner,
                'job_title' => 'Founder',
                'is_active' => true,
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'manager@fastsold.test'],
            [
                'business_id' => $business->id,
                'name' => 'Priya Raghunathan',
                'password' => 'Demo-Password-42',
                'role' => Role::Manager,
                'job_title' => 'Operations Manager',
                'is_active' => true,
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'staff@fastsold.test'],
            [
                'business_id' => $business->id,
                'name' => 'Marcus Oyelaran',
                'password' => 'Demo-Password-42',
                'role' => Role::Staff,
                'job_title' => 'Warehouse Associate',
                'is_active' => true,
            ],
        );

        return $owner;
    }

    /**
     * @return Collection<int, Category>
     */
    private function createCategories(): Collection
    {
        $definitions = [
            ['Power Tools', '#137A83'],
            ['Fasteners', '#FF6A3D'],
            ['Safety Equipment', '#6366F1'],
            ['Electrical', '#0EA5A4'],
            ['Packaging', '#A855F7'],
        ];

        return collect($definitions)->map(fn (array $definition): Category => Category::query()->updateOrCreate(
            ['slug' => Str::slug($definition[0])],
            ['name' => $definition[0], 'color' => $definition[1], 'is_active' => true],
        ));
    }

    /**
     * @return Collection<int, Supplier>
     */
    private function createSuppliers(): Collection
    {
        $definitions = [
            ['Northwind Industrial', 'NWI', 'orders@northwind.test', 7],
            ['Cascade Hardware Co', 'CHC', 'sales@cascadehw.test', 14],
            ['Lumen Electrical Supply', 'LES', 'hello@lumensupply.test', 10],
            ['Pacific Packaging Group', 'PPG', 'team@pacpack.test', 5],
        ];

        return collect($definitions)->map(fn (array $d): Supplier => Supplier::query()->updateOrCreate(
            ['code' => $d[1]],
            [
                'name' => $d[0],
                'email' => $d[2],
                'contact_name' => 'Accounts Team',
                'phone' => '+1-555-'.random_int(1000, 9999),
                'default_lead_time_days' => $d[3],
                'country' => 'US',
                'is_active' => true,
            ],
        ));
    }

    /**
     * @param  Collection<int, Category>  $categories
     * @param  Collection<int, Supplier>  $suppliers
     * @return Collection<int, Product>
     */
    private function createProducts(
        Collection $categories,
        Collection $suppliers,
        User $owner,
    ): Collection {
        // [sku, name, category index, unit, minimum level]
        $definitions = [
            ['FS-DRL-1801', '18V Brushless Drill Driver', 0, 'each', 8],
            ['FS-DRL-1802', '18V Impact Driver', 0, 'each', 6],
            ['FS-SAW-7250', '7.25in Circular Saw', 0, 'each', 4],
            ['FS-BLT-M8', 'M8 Hex Bolt, Zinc (box of 200)', 1, 'box', 20],
            ['FS-SCR-4530', '4.5 x 30mm Wood Screw (box of 500)', 1, 'box', 25],
            ['FS-ANC-1050', '10 x 50mm Wall Anchor (pack of 100)', 1, 'pack', 15],
            ['FS-GLV-CUT3', 'Cut-Resistant Gloves, Level 3', 2, 'pack', 30],
            ['FS-HLM-WHT', 'Hard Hat, Vented, White', 2, 'each', 12],
            ['FS-GOG-CLR', 'Safety Goggles, Anti-Fog', 2, 'each', 40],
            ['FS-CBL-2C15', '2-Core 1.5mm Cable (100m reel)', 3, 'each', 5],
            ['FS-SKT-DBL', 'Double Socket Outlet, White', 3, 'each', 25],
            ['FS-BRK-16A', '16A Circuit Breaker', 3, 'each', 18],
            ['FS-BOX-MED', 'Double-Wall Carton, Medium', 4, 'pack', 50],
            ['FS-TAP-48', '48mm Packing Tape (pack of 6)', 4, 'pack', 20],
            ['FS-WRP-500', 'Stretch Wrap, 500mm', 4, 'each', 10],
        ];

        return collect($definitions)->map(function (array $d) use ($categories, $suppliers, $owner): Product {
            /** @var Product $product */
            $product = Product::query()->updateOrCreate(
                ['sku' => $d[0]],
                [
                    'name' => $d[1],
                    'category_id' => $categories[$d[2]]->id,
                    'unit' => $d[3],
                    'minimum_stock_level' => $d[4],
                    'reorder_quantity' => $d[4] * 4,
                    'description' => 'Demo catalogue item for evaluating Fast Sold inventory management.',
                    'is_active' => true,
                    'created_by' => $owner->id,
                ],
            );

            // Two suppliers per product, demonstrating the many-to-many link.
            $linked = [
                $suppliers[$d[2] % $suppliers->count()]->id,
                $suppliers[($d[2] + 1) % $suppliers->count()]->id,
            ];

            $product->suppliers()->sync([
                $linked[0] => ['business_id' => $product->business_id, 'is_preferred' => true],
                $linked[1] => ['business_id' => $product->business_id, 'is_preferred' => false],
            ]);

            return $product;
        });
    }

    /**
     * Build a realistic movement history through the real inventory service, so
     * batches, allocations, the ledger and the quantity cache all agree.
     *
     * @param  Collection<int, Product>  $products
     * @param  Collection<int, Supplier>  $suppliers
     */
    private function recordMovements(
        Collection $products,
        Collection $suppliers,
        User $owner,
    ): void {
        $inventory = app(InventoryService::class);

        foreach ($products as $index => $product) {
            // Skip products that already have history, so the seeder is re-runnable.
            if ($product->stockMovements()->exists()) {
                continue;
            }

            // Three receipts, spread over the last ten weeks, so FIFO has
            // something meaningful to consume.
            $receiptSizes = [
                60 + ($index * 7) % 50,
                40 + ($index * 11) % 40,
                30 + ($index * 5) % 30,
            ];

            foreach ($receiptSizes as $wave => $size) {
                $inventory->stockIn(new StockInData(
                    productId: $product->id,
                    quantity: $size,
                    supplierId: $suppliers[($index + $wave) % $suppliers->count()]->id,
                    reference: sprintf('PO-%04d', 1000 + ($index * 3) + $wave),
                    unitCost: (string) round(4 + (($index * 3.7 + $wave * 1.9) % 80), 2),
                    receivedAt: Carbon::now()->subWeeks(10 - ($wave * 3))->setTime(9, 15),
                ), $owner);
            }

            // Withdrawals that leave a mix of healthy, low and empty products.
            $onHand = $product->fresh()->quantity_on_hand;

            $target = match ($index % 5) {
                0 => 0,                                       // out of stock
                1 => max(1, (int) ($product->minimum_stock_level * 0.6)), // low stock
                default => (int) ($onHand * 0.55),            // healthy
            };

            $toIssue = max(0, $onHand - $target);

            if ($toIssue > 0) {
                // Split across a few dated withdrawals so the trend chart and
                // the ledger both have texture.
                $slices = max(1, min(4, intdiv($toIssue, 12) ?: 1));
                $perSlice = intdiv($toIssue, $slices);
                $issued = 0;

                for ($slice = 0; $slice < $slices; $slice++) {
                    $amount = $slice === $slices - 1 ? $toIssue - $issued : $perSlice;

                    if ($amount <= 0) {
                        continue;
                    }

                    $inventory->stockOut(new StockOutData(
                        productId: $product->id,
                        quantity: $amount,
                        reference: sprintf('SO-%04d', 5000 + ($index * 4) + $slice),
                        reason: 'Customer order',
                        occurredAt: Carbon::now()->subDays(21 - ($slice * 5))->setTime(14, 30),
                    ), $owner);

                    $issued += $amount;
                }
            }
        }
    }

    /**
     * Reference prices for most products — a few are deliberately left without
     * one so the "missing price reference" notification has something to report.
     *
     * @param  Collection<int, Product>  $products
     */
    private function recordPrices(Collection $products, User $owner): void
    {
        $prices = app(PriceCatalogService::class);

        foreach ($products as $index => $product) {
            if ($index % 7 === 6) {
                continue;
            }

            $base = round(9.99 + (($index * 13.4) % 240), 2);

            // An earlier price first, then the current one, so the catalogue has
            // real history to show.
            $prices->setPrice($product, [
                'reference_price' => (string) round($base * 0.92, 2),
                'effective_from' => Carbon::now()->subMonths(5)->toDateString(),
                'source' => 'Supplier list, spring',
            ], $owner);

            $prices->setPrice($product, [
                'reference_price' => (string) $base,
                'effective_from' => Carbon::now()->subMonth()->toDateString(),
                'source' => 'Supplier list, current',
                'notes' => 'Reference only — does not affect inventory valuation.',
            ], $owner);
        }
    }
}
