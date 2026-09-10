<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Business;
use App\Services\Tenancy\RoleProvisioner;
use Illuminate\Console\Command;

/**
 * Brings the permission catalogue up to date and makes sure every business has
 * its three role rows.
 *
 * Run after any deployment that adds a permission to the Permission enum. It
 * never overwrites an Owner's customised permission matrix — it only fills in
 * what is missing.
 */
final class SyncTenantRoles extends Command
{
    protected $signature = 'tenants:sync-roles {--business= : Limit to one business id}';

    protected $description = 'Sync the permission catalogue and provision role definitions for every business';

    public function handle(RoleProvisioner $provisioner): int
    {
        $provisioner->syncPermissionCatalogue();
        $this->info('Permission catalogue synchronised.');

        $businesses = Business::query()
            ->when($this->option('business'), fn ($query, $id) => $query->whereKey($id))
            ->get();

        foreach ($businesses as $business) {
            $provisioner->provision($business);
            $this->line(sprintf('  Provisioned roles for %s', $business->name));
        }

        $this->info(sprintf('Done. %d business(es) processed.', $businesses->count()));

        return self::SUCCESS;
    }
}
