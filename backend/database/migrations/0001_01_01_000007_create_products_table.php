<?php

declare(strict_types=1);

use App\Enums\ProductUnit;
use App\Services\Inventory\InventoryService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Products.
 *
 * `quantity_on_hand` is a denormalised cache of the sum of
 * `stock_batches.quantity_remaining`. It is only ever written inside the same
 * database transaction as the batch rows (see
 * {@see InventoryService}) and is protected by a
 * non-negative check constraint, which is the last line of defence against
 * negative stock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('sku', 64);
            $table->string('barcode', 64)->nullable();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('unit', ProductUnit::values())->default(ProductUnit::Each->value);
            $table->string('image_path')->nullable();
            $table->unsignedInteger('minimum_stock_level')->default(0);
            $table->unsignedInteger('reorder_quantity')->nullable();
            $table->unsignedBigInteger('quantity_on_hand')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('archived_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['business_id', 'sku']);
            $table->index(['business_id', 'is_active']);
            $table->index(['business_id', 'category_id']);
            $table->index(['business_id', 'name']);
            // Supports the low-stock / out-of-stock dashboard queries.
            $table->index(['business_id', 'quantity_on_hand']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
