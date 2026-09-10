<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * The only seeder that runs in production.
 *
 * It seeds the global permission catalogue — reference data the application
 * needs to function — and nothing else. Demo businesses, products and movements
 * live in {@see DemoDataSeeder}, which must be invoked explicitly.
 */
final class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PermissionSeeder::class);
    }
}
