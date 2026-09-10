<?php

declare(strict_types=1);

namespace App\Services\Tenancy;

use App\Enums\AuditAction;
use App\Enums\Role;
use App\Models\Business;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Creates a new tenant and its first Owner.
 *
 * Runs unscoped — by definition there is no tenant context yet — and in one
 * transaction, so a half-created business (a user with no role rows, or a
 * business with no owner) cannot exist.
 */
final class BusinessRegistrationService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RoleProvisioner $roles,
    ) {}

    /**
     * @param  array{business_name: string, name: string, email: string, password: string, timezone?: string|null, currency?: string|null, industry?: string|null}  $attributes
     * @return array{business: Business, user: User}
     */
    public function register(array $attributes): array
    {
        return DB::transaction(fn (): array => TenantContext::unscoped(function () use ($attributes): array {
            $business = Business::create([
                'name' => $attributes['business_name'],
                'slug' => $this->uniqueSlug($attributes['business_name']),
                'contact_email' => $attributes['email'],
                'industry' => $attributes['industry'] ?? null,
                'timezone' => $attributes['timezone'] ?? 'UTC',
                'currency' => $attributes['currency'] ?? 'USD',
                'default_minimum_stock_level' => 0,
                'is_active' => true,
                'settings' => [
                    'notifications' => [
                        'low_stock_enabled' => true,
                        'out_of_stock_enabled' => true,
                    ],
                ],
            ]);

            $owner = User::create([
                'business_id' => $business->id,
                'name' => $attributes['name'],
                'email' => Str::lower(trim($attributes['email'])),
                'password' => $attributes['password'],
                'role' => Role::Owner,
                'is_active' => true,
            ]);

            // Seed this business's editable role definitions.
            $this->roles->provision($business);

            $this->audit->log(
                action: AuditAction::BusinessRegistered,
                description: sprintf('Business "%s" registered', $business->name),
                auditable: $business,
                newValues: ['business' => $business->name, 'owner_email' => $owner->email],
                actor: $owner,
                business: $business,
            );

            return ['business' => $business, 'user' => $owner];
        }));
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'business';
        $slug = $base;
        $suffix = 2;

        while (Business::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}
