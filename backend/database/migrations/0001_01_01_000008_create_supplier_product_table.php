<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Many-to-many between suppliers and products. `business_id` is carried on the
 * pivot so the tenant scope applies to the relationship itself, not just to
 * both ends of it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_product', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('supplier_sku', 64)->nullable();
            $table->unsignedSmallInteger('lead_time_days')->nullable();
            $table->unsignedInteger('minimum_order_quantity')->nullable();
            $table->boolean('is_preferred')->default(false);
            $table->timestamps();

            $table->unique(['supplier_id', 'product_id']);
            $table->index(['business_id', 'product_id']);
            $table->index(['business_id', 'supplier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_product');
    }
};
