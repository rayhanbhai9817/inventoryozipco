<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A stock batch is a single receipt of inventory: the unit of FIFO consumption.
 *
 * `quantity_remaining` starts equal to `quantity_received` and is decremented as
 * stock out / negative adjustments consume it. Both columns are unsigned, so the
 * database itself refuses to store a negative remainder.
 *
 * `unit_cost` is captured for traceability of what was paid on the receipt. It
 * is deliberately NOT used for inventory valuation anywhere in the application —
 * see docs/ARCHITECTURE.md → "Pricing is a reference catalogue".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_batches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('batch_number', 64);
            $table->string('reference', 128)->nullable();
            $table->unsignedBigInteger('quantity_received');
            $table->unsignedBigInteger('quantity_remaining');
            $table->decimal('unit_cost', 14, 4)->nullable();
            $table->string('currency', 3)->nullable();
            $table->timestamp('received_at');
            $table->date('expires_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['business_id', 'batch_number']);
            // The FIFO cursor: oldest received_at first, id as a deterministic
            // tie-breaker for batches received in the same instant.
            $table->index(['business_id', 'product_id', 'received_at', 'id'], 'stock_batches_fifo_index');
            $table->index(['business_id', 'supplier_id']);
            $table->index(['business_id', 'quantity_remaining']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_batches');
    }
};
