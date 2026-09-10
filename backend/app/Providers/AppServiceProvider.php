<?php

declare(strict_types=1);

namespace App\Providers;

use App\Enums\Permission;
use App\Models\Business;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\Supplier;
use App\Models\User;
use App\Policies\BusinessPolicy;
use App\Policies\CategoryPolicy;
use App\Policies\InventoryPolicy;
use App\Policies\ProductPolicy;
use App\Policies\ProductPricePolicy;
use App\Policies\SupplierPolicy;
use App\Policies\UserPolicy;
use App\Support\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureModels();
        $this->configurePasswords();
        $this->registerPolicies();
        $this->registerGates();
        $this->registerRouteBindings();
        $this->registerRateLimiters();
    }

    /**
     * Global API rate limiting.
     *
     * Keyed on the authenticated user so one tenant's traffic cannot exhaust
     * another's budget, and falling back to the IP for unauthenticated calls.
     */
    private function registerRateLimiters(): void
    {
        RateLimiter::for('api', fn (Request $request): Limit => $request->user() !== null
            ? Limit::perMinute(180)->by('user:'.$request->user()->getAuthIdentifier())
            : Limit::perMinute(40)->by('ip:'.$request->ip()));
    }

    private function configureModels(): void
    {
        // Fail loudly in development when a relationship is used without being
        // eager-loaded, or when an attribute that does not exist is read. Both
        // are bugs that are cheap to catch here and expensive to catch in
        // production.
        Model::preventLazyLoading(! $this->app->isProduction());
        Model::preventAccessingMissingAttributes(! $this->app->isProduction());
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());
    }

    private function configurePasswords(): void
    {
        Password::defaults(fn () => $this->app->isProduction()
            ? Password::min(10)->letters()->mixedCase()->numbers()->uncompromised()
            : Password::min(10)->letters()->mixedCase()->numbers());
    }

    private function registerPolicies(): void
    {
        Gate::policy(Product::class, ProductPolicy::class);
        Gate::policy(Category::class, CategoryPolicy::class);
        Gate::policy(Supplier::class, SupplierPolicy::class);
        Gate::policy(ProductPrice::class, ProductPricePolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Business::class, BusinessPolicy::class);
    }

    /**
     * Abilities that are not about a single model.
     *
     * Named with the same keys as the Permission enum so that a route's
     * `permission:` middleware and the controller's `authorize()` call read
     * identically, and a mismatch between them is obvious.
     */
    private function registerGates(): void
    {
        Gate::define('dashboard.view', fn (User $user): bool => $user->hasPermission(Permission::DashboardView));

        Gate::define('inventory.view', [InventoryPolicy::class, 'view']);
        Gate::define('inventory.stock-in', [InventoryPolicy::class, 'stockIn']);
        Gate::define('inventory.stock-out', [InventoryPolicy::class, 'stockOut']);
        Gate::define('inventory.adjust', [InventoryPolicy::class, 'adjust']);

        Gate::define('reports.view', fn (User $user): bool => $user->hasPermission(Permission::ReportsView));
        Gate::define('reports.export', fn (User $user): bool => $user->hasPermission(Permission::ReportsExport));

        Gate::define('notifications.view', fn (User $user): bool => $user->hasPermission(Permission::NotificationsView));
        Gate::define('audit-logs.view', fn (User $user): bool => $user->hasPermission(Permission::AuditLogsView));
    }

    /**
     * Tenant-scoped route model binding for `{user}`.
     *
     * Every other bound model carries the global BusinessScope, so a foreign id
     * already resolves to a 404. `User` is the model the tenant is derived from
     * and therefore has no global scope, so the constraint is applied here — a
     * 404 rather than a 403, so the endpoint does not confirm that an account
     * exists in some other business.
     */
    private function registerRouteBindings(): void
    {
        Route::bind('user', function (string $value): User {
            return User::query()
                ->where('business_id', TenantContext::businessId())
                ->findOrFail($value);
        });
    }
}
