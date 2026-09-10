<?php

declare(strict_types=1);

use App\Enums\MovementType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A stock movement is one recorded operation against one product.
 *
 * `quantity` is always a positive magnitude; `direction` (+1 / -1) carries the
 * sign. Storing them separately keeps "how many units moved" trivially
 * reportable while still letting adjustments go either way.
 *
 * `stock_movement_allocations` records exactly which batches an outbound
 * movement consumed and how much from each. That table is what makes FIFO
 * auditable rather than merely correct.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->enum('type', MovementType::values());
            $table->tinyInteger('direction');
            $table->unsignedBigInteger('quantity');
            $table->unsignedBigInteger('balance_after');
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained('stock_batches')->nullOnDelete();
            $table->string('reference', 128)->nullable();
            $table->string('reason', 128)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('occurred_at');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['business_id', 'product_id', 'occurred_at']);
            $table->index(['business_id', 'type', 'occurred_at']);
            $table->index(['business_id', 'supplier_id']);
            $table->index(['business_id', 'reference']);
        });

        Schema::create('stock_movement_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('stock_movement_id')->constrained('stock_movements')->cascadeOnDelete();
            $table->foreignId('stock_batch_id')->constrained('stock_batches')->cascadeOnDelete();
            $table->unsignedBigInteger('quantity');
            $table->decimal('unit_cost', 14, 4)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['business_id', 'stock_movement_id']);
            $table->index(['business_id', 'stock_batch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movement_allocations');
        Schema::dropIfExists('stock_movements');
    }
};
