<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The product price / reference catalogue.
 *
 * IMPORTANT: this data is reference information only. It never participates in
 * quantity arithmetic, FIFO consumption or ledger balances. Two tables with
 * distinct jobs:
 *
 *  - `product_prices` holds the single current reference price per product,
 *    which is what the catalogue screen and product detail page read.
 *  - `product_price_history` is an append-only record of every price that has
 *    ever been in effect, with the window it applied for.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_prices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('reference_price', 14, 4);
            $table->string('currency', 3)->default('USD');
            $table->date('effective_from');
            $table->string('source', 128)->nullable();
            $table->string('image_path')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['business_id', 'product_id']);
            $table->index(['business_id', 'effective_from']);
        });

        Schema::create('product_price_history', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('reference_price', 14, 4);
            $table->decimal('previous_price', 14, 4)->nullable();
            $table->string('currency', 3)->default('USD');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('source', 128)->nullable();
            $table->string('image_path')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->index(['business_id', 'product_id', 'effective_from'], 'price_history_product_timeline_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_history');
        Schema::dropIfExists('product_prices');
    }
};
