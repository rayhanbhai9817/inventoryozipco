<?php

declare(strict_types=1);

namespace Tests;

use App\Models\Business;
use App\Models\User;
use App\Services\Tenancy\RoleProvisioner;
use App\Support\TenantContext;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function tearDown(): void
    {
        // Tenant context is process state; never let it bleed between tests.
        TenantContext::clear();

        parent::tearDown();
    }

    /**
     * Create a business with its role definitions provisioned and an owner.
     *
     * @return array{business: Business, owner: User}
     */
    protected function createBusinessWithOwner(array $businessAttributes = []): array
    {
        $business = Business::factory()->create($businessAttributes);

        app(RoleProvisioner::class)->provision($business);

        $owner = User::factory()->owner()->forBusiness($business)->create();

        return ['business' => $business, 'owner' => $owner];
    }

    /**
     * Run a callback with the tenant context set, the way a real request would.
     *
     * @template TReturn
     *
     * @param  callable(): TReturn  $callback
     * @return TReturn
     */
    protected function asTenant(Business $business, callable $callback): mixed
    {
        return TenantContext::forBusiness($business, $callback);
    }

    /**
     * Authenticate as a user over the API and activate their tenant context.
     */
    protected function actingAsApi(User $user): static
    {
        // Reload from the database so the acting model carries every column, as
        // it would in a real request. A factory-built instance only holds the
        // attributes the factory set, which is not what the API sees.
        $user->refresh();

        $this->actingAs($user, 'sanctum');

        if ($user->business !== null) {
            TenantContext::set($user->business);
        }

        return $this;
    }
}
