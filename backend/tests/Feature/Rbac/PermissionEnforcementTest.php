<?php

declare(strict_types=1);

namespace Tests\Feature\Rbac;

use App\Enums\Permission;
use App\Enums\Role;
use App\Models\PermissionDefinition;
use App\Models\Product;
use App\Models\RoleDefinition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * RBAC is enforced by the backend, not by the frontend hiding buttons.
 */
final class PermissionEnforcementTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_owner_holds_every_permission(): void
    {
        ['owner' => $owner] = $this->createBusinessWithOwner();

        foreach (Permission::cases() as $permission) {
            $this->assertTrue(
                $owner->hasPermission($permission),
                "Owner should hold {$permission->value}"
            );
        }
    }

    public function test_staff_cannot_manage_products(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $staff = User::factory()->staff()->forBusiness($business)->create();

        $this->assertTrue($staff->hasPermission(Permission::ProductsView));
        $this->assertFalse($staff->hasPermission(Permission::ProductsManage));

        $this->actingAsApi($staff)
            ->postJson('/api/v1/products', [
                'sku' => 'FS-TEST-1',
                'name' => 'Unauthorised Widget',
                'unit' => 'each',
            ])
            ->assertForbidden();

        $this->assertSame(0, Product::query()->withoutGlobalScopes()->count());
    }

    public function test_staff_cannot_read_the_audit_log(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $staff = User::factory()->staff()->forBusiness($business)->create();

        $this->actingAsApi($staff)->getJson('/api/v1/audit-logs')->assertForbidden();
    }

    public function test_a_manager_can_record_stock_movements(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $manager = User::factory()->manager()->forBusiness($business)->create();
        $product = Product::factory()->forBusiness($business)->create();

        $this->actingAsApi($manager)
            ->postJson('/api/v1/stock-in', ['product_id' => $product->id, 'quantity' => 12])
            ->assertCreated();

        $this->assertSame(12, $product->fresh()->quantity_on_hand);
    }

    public function test_a_manager_cannot_manage_users_or_roles(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $manager = User::factory()->manager()->forBusiness($business)->create();

        $this->assertFalse($manager->hasPermission(Permission::UsersManage));
        $this->assertFalse($manager->hasPermission(Permission::RolesManage));

        $this->actingAsApi($manager)->getJson('/api/v1/settings/roles')->assertForbidden();
    }

    public function test_owner_only_permissions_can_never_be_granted_to_another_role(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $staff = User::factory()->staff()->forBusiness($business)->create();

        // Force the permission onto the Staff role in the database, bypassing the
        // API's validation, and confirm the resolver still refuses it.
        $roleDefinition = RoleDefinition::query()
            ->withoutGlobalScopes()
            ->where('business_id', $business->id)
            ->where('key', Role::Staff->value)
            ->sole();

        $auditPermission = PermissionDefinition::query()
            ->where('key', Permission::AuditLogsView->value)
            ->sole();

        $roleDefinition->permissions()->attach($auditPermission->id);

        $this->assertFalse($staff->fresh()->hasPermission(Permission::AuditLogsView));
    }

    public function test_a_per_user_grant_widens_access_without_changing_the_role(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $staff = User::factory()->staff()->forBusiness($business)->create();

        $this->assertFalse($staff->hasPermission(Permission::ProductsManage));

        $permission = PermissionDefinition::query()
            ->where('key', Permission::ProductsManage->value)
            ->sole();

        $staff->permissionOverrides()->attach($permission->id, ['granted' => true]);
        $staff = $staff->fresh();

        $this->assertTrue($staff->hasPermission(Permission::ProductsManage));
        $this->assertSame(Role::Staff, $staff->role);
    }

    public function test_a_per_user_revocation_narrows_access_below_the_role_default(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $manager = User::factory()->manager()->forBusiness($business)->create();

        $this->assertTrue($manager->hasPermission(Permission::StockOutCreate));

        $permission = PermissionDefinition::query()
            ->where('key', Permission::StockOutCreate->value)
            ->sole();

        $manager->permissionOverrides()->attach($permission->id, ['granted' => false]);
        $manager = $manager->fresh();

        $this->assertFalse($manager->hasPermission(Permission::StockOutCreate));

        $product = Product::factory()->forBusiness($business)->create();

        $this->actingAsApi($manager)
            ->postJson('/api/v1/stock-out', ['product_id' => $product->id, 'quantity' => 1])
            ->assertForbidden();
    }

    public function test_a_manager_cannot_promote_anyone_to_owner(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $manager = User::factory()->manager()->forBusiness($business)->create();
        $staff = User::factory()->staff()->forBusiness($business)->create();

        // Blocked by the users.manage permission before the role rule even
        // applies — a manager has no user administration at all.
        $this->actingAsApi($manager)
            ->patchJson("/api/v1/users/{$staff->id}", ['role' => 'owner'])
            ->assertForbidden();

        $this->assertSame(Role::Staff, $staff->fresh()->role);
    }

    public function test_an_owner_cannot_change_their_own_role(): void
    {
        ['owner' => $owner] = $this->createBusinessWithOwner();

        $this->actingAsApi($owner)
            ->patchJson("/api/v1/users/{$owner->id}", ['role' => 'staff'])
            ->assertForbidden();

        $this->assertSame(Role::Owner, $owner->fresh()->role);
    }

    public function test_the_last_active_owner_cannot_be_deactivated(): void
    {
        ['business' => $business, 'owner' => $owner] = $this->createBusinessWithOwner();
        $secondOwner = User::factory()->owner()->forBusiness($business)->create();

        // With two owners, deactivating one is allowed.
        $this->actingAsApi($owner)
            ->patchJson("/api/v1/users/{$secondOwner->id}", ['is_active' => false])
            ->assertOk();

        $this->assertFalse($secondOwner->fresh()->is_active);

        // Now only one active owner remains; a second owner cannot demote them.
        $thirdOwner = User::factory()->owner()->forBusiness($business)->create();

        $this->actingAsApi($thirdOwner)
            ->patchJson("/api/v1/users/{$owner->id}", ['is_active' => false])
            ->assertOk();

        // `$thirdOwner` is now the last active owner and cannot be removed by
        // the already-deactivated ones, nor by themselves.
        $this->actingAsApi($thirdOwner)
            ->patchJson("/api/v1/users/{$thirdOwner->id}", ['is_active' => false])
            ->assertForbidden();

        $this->assertTrue($thirdOwner->fresh()->is_active);
    }

    public function test_the_me_endpoint_reports_the_permissions_the_frontend_renders_from(): void
    {
        ['business' => $business] = $this->createBusinessWithOwner();
        $staff = User::factory()->staff()->forBusiness($business)->create();

        $response = $this->actingAsApi($staff)->getJson('/api/v1/auth/me')->assertOk();

        $permissions = $response->json('user.permissions');

        $this->assertContains(Permission::InventoryView->value, $permissions);
        $this->assertNotContains(Permission::UsersManage->value, $permissions);
        $this->assertNotContains(Permission::AuditLogsView->value, $permissions);
    }
}
