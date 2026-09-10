<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\Permission;
use App\Services\Tenancy\RoleProvisioner;
use Illuminate\Database\Seeder;

/**
 * Synchronises the `permissions` table with the Permission enum.
 *
 * Safe and idempotent: run it after every deployment that adds a permission.
 */
final class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(RoleProvisioner::class)->syncPermissionCatalogue();

        $this->command?->info(sprintf('Synchronised %d permissions.', count(Permission::cases())));
    }
}
