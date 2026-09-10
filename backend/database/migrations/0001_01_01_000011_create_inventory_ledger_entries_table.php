<?php

declare(strict_types=1);

use App\Enums\MovementType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The immutable inventory ledger.
 *
 * One row per batch-level effect of every inventory change, carrying the running
 * balance for the product at that point in time. The table is append-only by
 * design:
 *
 *  - there is no `updated_at` column,
 *  - the Eloquent model refuses updates and deletes,
 *  - no API route exposes a write other than the inventory service.
 *
 * Corrections are made by recording a compensating adjustment, never by editing
 * history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_ledger_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('stock_movement_id')->constrained('stock_movements')->cascadeOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained('stock_batches')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->enum('type', MovementType::values());
            // Signed: positive for inbound, negative for outbound.
            $table->bigInteger('quantity_change');
            $table->unsignedBigInteger('balance_after');
            $table->string('reference', 128)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamp('created_at')->nullable();

            $table->index(['business_id', 'product_id', 'occurred_at', 'id'], 'ledger_product_timeline_index');
            $table->index(['business_id', 'occurred_at']);
            $table->index(['business_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_ledger_entries');
    }
};
