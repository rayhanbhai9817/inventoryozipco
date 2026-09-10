<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Database-level guarantees for the non-negotiable inventory rules.
 *
 * The application already enforces all of these inside transactions, but
 * encoding them in the schema means a bug, a console script or a future feature
 * physically cannot leave inventory in an impossible state.
 *
 * SQLite cannot add constraints to an existing table, so these are applied on
 * PostgreSQL (the production engine) and skipped elsewhere. The test suite runs
 * on SQLite and asserts the same rules at the service layer.
 */
return new class extends Migration
{
    /**
     * @var array<string, string>
     */
    private array $constraints = [
        'stock_batches_remaining_within_received' => 'ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_remaining_within_received CHECK (quantity_remaining <= quantity_received)',
        'stock_batches_received_positive' => 'ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_received_positive CHECK (quantity_received > 0)',
        'stock_movements_quantity_positive' => 'ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_quantity_positive CHECK (quantity > 0)',
        'stock_movements_direction_valid' => 'ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_direction_valid CHECK (direction IN (-1, 1))',
        'stock_movement_allocations_quantity_positive' => 'ALTER TABLE stock_movement_allocations ADD CONSTRAINT stock_movement_allocations_quantity_positive CHECK (quantity > 0)',
        'ledger_quantity_change_non_zero' => 'ALTER TABLE inventory_ledger_entries ADD CONSTRAINT ledger_quantity_change_non_zero CHECK (quantity_change <> 0)',
        'product_prices_non_negative' => 'ALTER TABLE product_prices ADD CONSTRAINT product_prices_non_negative CHECK (reference_price >= 0)',
    ];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->constraints as $sql) {
            DB::statement($sql);
        }

        // Partial index: FIFO only ever scans batches that still have stock.
        DB::statement(
            'CREATE INDEX stock_batches_open_fifo_index ON stock_batches (business_id, product_id, received_at, id) WHERE quantity_remaining > 0'
        );
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS stock_batches_open_fifo_index');

        foreach (array_keys($this->constraints) as $name) {
            $table = match (true) {
                str_starts_with($name, 'stock_batches') => 'stock_batches',
                str_starts_with($name, 'stock_movement_allocations') => 'stock_movement_allocations',
                str_starts_with($name, 'stock_movements') => 'stock_movements',
                str_starts_with($name, 'ledger') => 'inventory_ledger_entries',
                default => 'product_prices',
            };

            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$name}");
        }
    }
};
