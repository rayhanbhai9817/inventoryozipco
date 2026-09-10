<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PriceCatalogController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\StockInController;
use App\Http\Controllers\Api\V1\StockOutController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Fast Sold LLC — REST API v1
|--------------------------------------------------------------------------
|
| Three layers of protection apply to every authenticated route:
|
|   1. `auth:sanctum`        — a valid API token.
|   2. `tenant`              — resolves the business from the token's user and
|                              activates the global tenant query scope. Also
|                              rejects deactivated users and businesses.
|   3. `permission:<key>`    — the coarse capability gate.
|
| Controllers then call the matching policy for per-record authorisation, so a
| permission alone is never sufficient to reach another tenant's record.
|
*/

Route::prefix('v1')->group(function (): void {

    /*
    |----------------------------------------------------------------------
    | Public — authentication
    |----------------------------------------------------------------------
    | Rate limited far more tightly than the rest of the API. Registration is
    | capped per IP to keep automated tenant creation impractical.
    */
    Route::prefix('auth')->group(function (): void {
        Route::post('register', [AuthController::class, 'register'])
            ->middleware('throttle:6,60')
            ->name('auth.register');

        Route::post('login', [AuthController::class, 'login'])
            ->middleware('throttle:10,1')
            ->name('auth.login');
    });

    /*
    |----------------------------------------------------------------------
    | Authenticated
    |----------------------------------------------------------------------
    */
    Route::middleware(['auth:sanctum', 'tenant'])->group(function (): void {

        // --- Session ------------------------------------------------------
        Route::prefix('auth')->group(function (): void {
            Route::get('me', [AuthController::class, 'me'])->name('auth.me');
            Route::post('logout', [AuthController::class, 'logout'])->name('auth.logout');
            Route::post('logout-all', [AuthController::class, 'logoutAll'])->name('auth.logout-all');
        });

        // --- Dashboard ----------------------------------------------------
        Route::get('dashboard', DashboardController::class)
            ->middleware('permission:dashboard.view')
            ->name('dashboard');

        // --- Products -----------------------------------------------------
        Route::prefix('products')->name('products.')->group(function (): void {
            Route::get('/', [ProductController::class, 'index'])
                ->middleware('permission:products.view')->name('index');

            Route::post('/', [ProductController::class, 'store'])
                ->middleware('permission:products.manage')->name('store');

            Route::get('{product}', [ProductController::class, 'show'])
                ->middleware('permission:products.view')->name('show');

            Route::match(['put', 'patch'], '{product}', [ProductController::class, 'update'])
                ->middleware('permission:products.manage')->name('update');

            Route::delete('{product}', [ProductController::class, 'destroy'])
                ->middleware('permission:products.delete')->name('destroy');

            Route::post('{product}/archive', [ProductController::class, 'archive'])
                ->middleware('permission:products.delete')->name('archive');

            Route::post('{product}/restore', [ProductController::class, 'restore'])
                ->middleware('permission:products.delete')->name('restore');

            Route::get('{product}/ledger', [ProductController::class, 'ledger'])
                ->middleware('permission:inventory.view')->name('ledger');

            Route::get('{product}/movements', [ProductController::class, 'movements'])
                ->middleware('permission:inventory.view')->name('movements');

            Route::get('{product}/batches', [ProductController::class, 'batches'])
                ->middleware('permission:inventory.view')->name('batches');

            Route::put('{product}/suppliers', [ProductController::class, 'syncSuppliers'])
                ->middleware('permission:products.manage,suppliers.manage')->name('suppliers.sync');
        });

        // --- Categories ---------------------------------------------------
        Route::prefix('categories')->name('categories.')->group(function (): void {
            Route::get('/', [CategoryController::class, 'index'])
                ->middleware('permission:categories.view')->name('index');

            Route::post('/', [CategoryController::class, 'store'])
                ->middleware('permission:categories.manage')->name('store');

            Route::get('{category}', [CategoryController::class, 'show'])
                ->middleware('permission:categories.view')->name('show');

            Route::match(['put', 'patch'], '{category}', [CategoryController::class, 'update'])
                ->middleware('permission:categories.manage')->name('update');

            Route::post('{category}/archive', [CategoryController::class, 'archive'])
                ->middleware('permission:categories.manage')->name('archive');

            Route::delete('{category}', [CategoryController::class, 'destroy'])
                ->middleware('permission:categories.manage')->name('destroy');
        });

        // --- Suppliers ----------------------------------------------------
        Route::prefix('suppliers')->name('suppliers.')->group(function (): void {
            Route::get('/', [SupplierController::class, 'index'])
                ->middleware('permission:suppliers.view')->name('index');

            Route::post('/', [SupplierController::class, 'store'])
                ->middleware('permission:suppliers.manage')->name('store');

            Route::get('{supplier}', [SupplierController::class, 'show'])
                ->middleware('permission:suppliers.view')->name('show');

            Route::match(['put', 'patch'], '{supplier}', [SupplierController::class, 'update'])
                ->middleware('permission:suppliers.manage')->name('update');

            Route::delete('{supplier}', [SupplierController::class, 'destroy'])
                ->middleware('permission:suppliers.manage')->name('destroy');

            Route::post('{supplier}/toggle-active', [SupplierController::class, 'toggleActive'])
                ->middleware('permission:suppliers.manage')->name('toggle-active');

            Route::get('{supplier}/batches', [SupplierController::class, 'batches'])
                ->middleware('permission:inventory.view')->name('batches');

            Route::get('{supplier}/movements', [SupplierController::class, 'movements'])
                ->middleware('permission:inventory.view')->name('movements');
        });

        // --- Inventory ----------------------------------------------------
        Route::prefix('inventory')->name('inventory.')->group(function (): void {
            Route::get('/', [InventoryController::class, 'index'])
                ->middleware('permission:inventory.view')->name('index');

            Route::get('ledger', [InventoryController::class, 'ledger'])
                ->middleware('permission:inventory.view')->name('ledger');

            Route::get('movements', [InventoryController::class, 'movements'])
                ->middleware('permission:inventory.view')->name('movements');

            Route::get('batches', [InventoryController::class, 'batches'])
                ->middleware('permission:inventory.view')->name('batches');

            Route::get('products/{product}/availability', [InventoryController::class, 'availability'])
                ->middleware('permission:inventory.view')->name('availability');

            Route::post('adjustments', [InventoryController::class, 'adjust'])
                ->middleware('permission:inventory.adjust')->name('adjust');
        });

        // --- Stock IN -----------------------------------------------------
        Route::prefix('stock-in')->name('stock-in.')->group(function (): void {
            Route::get('/', [StockInController::class, 'index'])
                ->middleware('permission:inventory.view')->name('index');

            Route::post('/', [StockInController::class, 'store'])
                ->middleware('permission:inventory.stock-in')->name('store');
        });

        // --- Stock OUT ----------------------------------------------------
        Route::prefix('stock-out')->name('stock-out.')->group(function (): void {
            Route::get('/', [StockOutController::class, 'index'])
                ->middleware('permission:inventory.view')->name('index');

            Route::post('/', [StockOutController::class, 'store'])
                ->middleware('permission:inventory.stock-out')->name('store');

            // Non-mutating FIFO preview for the stock-out form.
            Route::get('preview', [StockOutController::class, 'preview'])
                ->middleware('permission:inventory.stock-out')->name('preview');
        });

        // --- Price / reference catalogue ----------------------------------
        Route::prefix('price-catalog')->name('price-catalog.')->group(function (): void {
            Route::get('/', [PriceCatalogController::class, 'index'])
                ->middleware('permission:prices.view')->name('index');

            Route::post('/', [PriceCatalogController::class, 'store'])
                ->middleware('permission:prices.manage')->name('store');

            Route::get('products/{product}/history', [PriceCatalogController::class, 'history'])
                ->middleware('permission:prices.view')->name('history');

            Route::get('{price}', [PriceCatalogController::class, 'show'])
                ->middleware('permission:prices.view')->name('show');

            Route::delete('{price}', [PriceCatalogController::class, 'destroy'])
                ->middleware('permission:prices.manage')->name('destroy');
        });

        // --- Reports ------------------------------------------------------
        Route::prefix('reports')->name('reports.')->middleware('permission:reports.view')->group(function (): void {
            Route::get('inventory-summary', [ReportController::class, 'inventorySummary'])->name('inventory-summary');
            Route::get('stock-in', [ReportController::class, 'stockIn'])->name('stock-in');
            Route::get('stock-out', [ReportController::class, 'stockOut'])->name('stock-out');
            Route::get('product-movement', [ReportController::class, 'productMovement'])->name('product-movement');
            Route::get('low-stock', [ReportController::class, 'lowStock'])->name('low-stock');
            Route::get('out-of-stock', [ReportController::class, 'outOfStock'])->name('out-of-stock');
            Route::get('suppliers', [ReportController::class, 'suppliers'])->name('suppliers');
            Route::get('ledger', [ReportController::class, 'ledger'])->name('ledger');
            Route::get('price-history', [ReportController::class, 'priceHistory'])->name('price-history');

            // CSV export is a separate permission: seeing a report and being able
            // to take the whole dataset out of the platform are different acts.
            Route::get('{report}/export', [ReportController::class, 'export'])
                ->middleware('permission:reports.export')
                ->whereIn('report', [
                    'inventory-summary', 'stock-in', 'stock-out', 'product-movement',
                    'low-stock', 'out-of-stock', 'suppliers', 'ledger', 'price-history',
                ])
                ->name('export');
        });

        // --- Notifications ------------------------------------------------
        Route::prefix('notifications')->name('notifications.')->middleware('permission:notifications.view')->group(function (): void {
            Route::get('/', [NotificationController::class, 'index'])->name('index');
            Route::get('unread-count', [NotificationController::class, 'unreadCount'])->name('unread-count');
            Route::post('read-all', [NotificationController::class, 'markAllRead'])->name('read-all');
            Route::post('{notification}/read', [NotificationController::class, 'markRead'])->name('read');
        });

        // --- Audit logs (read-only) ---------------------------------------
        Route::prefix('audit-logs')->name('audit-logs.')->middleware('permission:audit-logs.view')->group(function (): void {
            Route::get('/', [AuditLogController::class, 'index'])->name('index');
            Route::get('filters', [AuditLogController::class, 'filters'])->name('filters');
        });

        // --- Users --------------------------------------------------------
        Route::prefix('users')->name('users.')->group(function (): void {
            Route::get('/', [UserController::class, 'index'])
                ->middleware('permission:users.view')->name('index');

            Route::post('/', [UserController::class, 'store'])
                ->middleware('permission:users.manage')->name('store');

            Route::get('{user}', [UserController::class, 'show'])
                ->middleware('permission:users.view')->name('show');

            Route::match(['put', 'patch'], '{user}', [UserController::class, 'update'])
                ->middleware('permission:users.manage')->name('update');

            Route::delete('{user}', [UserController::class, 'destroy'])
                ->middleware('permission:users.manage')->name('destroy');

            Route::get('{user}/activity', [UserController::class, 'activity'])
                ->middleware('permission:users.view')->name('activity');
        });

        // --- Settings -----------------------------------------------------
        Route::prefix('settings')->name('settings.')->group(function (): void {
            // Profile and password are always the user's own, so they need no
            // administrative permission.
            Route::get('profile', [SettingsController::class, 'profile'])->name('profile');
            Route::match(['put', 'patch'], 'profile', [SettingsController::class, 'updateProfile'])->name('profile.update');
            Route::put('password', [SettingsController::class, 'updatePassword'])->name('password');

            Route::get('business', [SettingsController::class, 'business'])
                ->middleware('permission:settings.view')->name('business');

            Route::match(['put', 'patch'], 'business', [SettingsController::class, 'updateBusiness'])
                ->middleware('permission:settings.manage')->name('business.update');

            Route::get('permissions', [SettingsController::class, 'permissions'])
                ->middleware('permission:settings.view')->name('permissions');

            Route::get('roles', [SettingsController::class, 'roles'])
                ->middleware('permission:roles.manage')->name('roles');

            Route::put('roles/{role}', [SettingsController::class, 'updateRole'])
                ->middleware('permission:roles.manage')
                ->whereIn('role', ['owner', 'manager', 'staff'])
                ->name('roles.update');
        });
    });
});
