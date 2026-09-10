<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Data\StockAdjustmentData;
use App\Data\StockInData;
use App\Data\StockOutData;
use App\Enums\AuditAction;
use App\Enums\MovementType;
use App\Exceptions\InsufficientStockException;
use App\Models\InventoryLedgerEntry;
use App\Models\Product;
use App\Models\StockBatch;
use App\Models\StockMovement;
use App\Models\StockMovementAllocation;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * The single writer of inventory state.
 *
 * Every path that changes a quantity goes through this class, which guarantees
 * the non-negotiable rules:
 *
 *  - Quantities never go negative. Availability is re-read inside the
 *    transaction under a row lock, so two concurrent withdrawals cannot both
 *    see the same stock.
 *  - Stock out consumes the oldest batch first (FIFO), decided here in the
 *    backend and recorded in `stock_movement_allocations` so the decision is
 *    auditable afterwards.
 *  - Every change writes an immutable ledger entry carrying the running balance.
 *  - All of it happens in one database transaction: a failure anywhere leaves
 *    quantities, batches, movements and the ledger untouched.
 *
 * Reference prices are never consulted. Inventory is a quantity system.
 */
final class InventoryService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Record a receipt of stock: opens a new FIFO batch and increases the
     * product's quantity on hand.
     */
    public function stockIn(StockInData $data, User $actor): StockMovement
    {
        $this->assertPositive($data->quantity);

        return DB::transaction(function () use ($data, $actor): StockMovement {
            $product = $this->lockProduct($data->productId);
            $receivedAt = $data->receivedAt ?? Carbon::now();

            $batch = StockBatch::create([
                'business_id' => $product->business_id,
                'product_id' => $product->id,
                'supplier_id' => $data->supplierId,
                'batch_number' => $data->batchNumber ?: $this->generateBatchNumber($product),
                'reference' => $data->reference,
                'quantity_received' => $data->quantity,
                'quantity_remaining' => $data->quantity,
                'unit_cost' => $data->unitCost,
                'currency' => $data->unitCost !== null ? $product->business?->currency : null,
                'received_at' => $receivedAt,
                'expires_at' => $data->expiresAt,
                'notes' => $data->notes,
                'created_by' => $actor->id,
            ]);

            // Derive the new balance from the batch rows rather than the cached
            // column, so a receipt also re-synchronises any drift.
            $balanceAfter = $this->availableQuantity($product);
            $this->writeQuantityOnHand($product, $balanceAfter);

            $movement = StockMovement::create([
                'business_id' => $product->business_id,
                'product_id' => $product->id,
                'type' => MovementType::StockIn,
                'direction' => 1,
                'quantity' => $data->quantity,
                'balance_after' => $balanceAfter,
                'supplier_id' => $data->supplierId,
                'stock_batch_id' => $batch->id,
                'reference' => $data->reference,
                'notes' => $data->notes,
                'occurred_at' => $receivedAt,
                'created_by' => $actor->id,
            ]);

            $this->writeLedgerEntry(
                movement: $movement,
                batch: $batch,
                quantityChange: $data->quantity,
                balanceAfter: $balanceAfter,
                actor: $actor,
                meta: ['batch_number' => $batch->batch_number],
            );

            $this->audit->log(
                action: AuditAction::StockIn,
                description: sprintf('Received %d %s of %s (%s)', $data->quantity, $product->unit->abbreviation(), $product->name, $product->sku),
                auditable: $product,
                newValues: [
                    'quantity' => $data->quantity,
                    'batch_number' => $batch->batch_number,
                    'supplier_id' => $data->supplierId,
                    'reference' => $data->reference,
                    'balance_after' => $balanceAfter,
                ],
                actor: $actor,
            );

            $this->notifications->stockInRecorded($product, $movement);
            $this->notifications->evaluateStockLevel($product->refresh());

            return $movement->refresh()->load(['product', 'supplier', 'batch']);
        });
    }

    /**
     * Record a withdrawal of stock, consuming batches oldest-first.
     *
     * @throws InsufficientStockException when the product does not hold enough stock
     */
    public function stockOut(StockOutData $data, User $actor): StockMovement
    {
        $this->assertPositive($data->quantity);

        return DB::transaction(function () use ($data, $actor): StockMovement {
            $product = $this->lockProduct($data->productId);
            $occurredAt = $data->occurredAt ?? Carbon::now();

            // Availability comes from the batch rows, which are the source of
            // truth. If the denormalised cache has drifted we trust the batches
            // and the write below silently re-synchronises it.
            $startingBalance = $this->availableQuantity($product);

            if ($data->quantity > $startingBalance) {
                // Aborts the transaction: nothing has been written yet, and the
                // lock is released on rollback.
                throw InsufficientStockException::for($product, $data->quantity, $startingBalance);
            }

            $balanceAfter = $startingBalance - $data->quantity;
            $this->writeQuantityOnHand($product, $balanceAfter);

            $movement = StockMovement::create([
                'business_id' => $product->business_id,
                'product_id' => $product->id,
                'type' => MovementType::StockOut,
                'direction' => -1,
                'quantity' => $data->quantity,
                'balance_after' => $balanceAfter,
                'reference' => $data->reference,
                'reason' => $data->reason,
                'notes' => $data->notes,
                'occurred_at' => $occurredAt,
                'created_by' => $actor->id,
            ]);

            $this->consumeFifo(
                product: $product,
                movement: $movement,
                quantity: $data->quantity,
                startingBalance: $startingBalance,
                actor: $actor,
            );

            $this->audit->log(
                action: AuditAction::StockOut,
                description: sprintf('Issued %d %s of %s (%s)', $data->quantity, $product->unit->abbreviation(), $product->name, $product->sku),
                auditable: $product,
                newValues: [
                    'quantity' => $data->quantity,
                    'reference' => $data->reference,
                    'reason' => $data->reason,
                    'balance_after' => $balanceAfter,
                ],
                actor: $actor,
            );

            $this->notifications->stockOutRecorded($product, $movement);
            $this->notifications->evaluateStockLevel($product->refresh());

            return $movement->refresh()->load(['product', 'allocations.batch']);
        });
    }

    /**
     * Apply a signed correction to a product's quantity.
     *
     * A positive delta opens a new batch dated now (so it sits at the end of the
     * FIFO queue). A negative delta consumes existing batches FIFO and is
     * subject to the same non-negative guarantee as stock out.
     *
     * @throws InsufficientStockException when a negative adjustment exceeds availability
     */
    public function adjust(StockAdjustmentData $data, User $actor): StockMovement
    {
        if ($data->quantityDelta === 0) {
            throw new InvalidArgumentException('An adjustment must change the quantity by a non-zero amount.');
        }

        return DB::transaction(function () use ($data, $actor): StockMovement {
            $product = $this->lockProduct($data->productId);
            $occurredAt = $data->occurredAt ?? Carbon::now();
            $magnitude = abs($data->quantityDelta);
            $direction = $data->isIncrease() ? 1 : -1;

            // As in stockOut(): the batch rows are authoritative.
            $startingBalance = $this->availableQuantity($product);

            if (! $data->isIncrease() && $magnitude > $startingBalance) {
                throw InsufficientStockException::for($product, $magnitude, $startingBalance);
            }

            $balanceAfter = $startingBalance + $data->quantityDelta;
            $this->writeQuantityOnHand($product, $balanceAfter);

            $batch = null;

            if ($data->isIncrease()) {
                $batch = StockBatch::create([
                    'business_id' => $product->business_id,
                    'product_id' => $product->id,
                    'batch_number' => $this->generateBatchNumber($product, 'ADJ'),
                    'reference' => $data->reference,
                    'quantity_received' => $magnitude,
                    'quantity_remaining' => $magnitude,
                    'received_at' => $occurredAt,
                    'notes' => $data->reason,
                    'created_by' => $actor->id,
                ]);
            }

            $movement = StockMovement::create([
                'business_id' => $product->business_id,
                'product_id' => $product->id,
                'type' => MovementType::Adjustment,
                'direction' => $direction,
                'quantity' => $magnitude,
                'balance_after' => $balanceAfter,
                'stock_batch_id' => $batch?->id,
                'reference' => $data->reference,
                'reason' => $data->reason,
                'notes' => $data->notes,
                'occurred_at' => $occurredAt,
                'created_by' => $actor->id,
            ]);

            if ($data->isIncrease()) {
                $this->writeLedgerEntry(
                    movement: $movement,
                    batch: $batch,
                    quantityChange: $magnitude,
                    balanceAfter: $balanceAfter,
                    actor: $actor,
                    meta: ['reason' => $data->reason, 'batch_number' => $batch?->batch_number],
                );
            } else {
                $this->consumeFifo(
                    product: $product,
                    movement: $movement,
                    quantity: $magnitude,
                    startingBalance: $startingBalance,
                    actor: $actor,
                    meta: ['reason' => $data->reason],
                );
            }

            $this->audit->log(
                action: AuditAction::InventoryAdjusted,
                description: sprintf(
                    'Adjusted %s (%s) by %+d %s — %s',
                    $product->name,
                    $product->sku,
                    $data->quantityDelta,
                    $product->unit->abbreviation(),
                    $data->reason
                ),
                auditable: $product,
                oldValues: ['quantity_on_hand' => $startingBalance],
                newValues: ['quantity_on_hand' => $balanceAfter, 'reason' => $data->reason],
                actor: $actor,
            );

            $this->notifications->inventoryAdjusted($product, $movement);
            $this->notifications->evaluateStockLevel($product->refresh());

            return $movement->refresh()->load(['product', 'allocations.batch']);
        });
    }

    /**
     * Consume `quantity` units from the product's open batches, oldest first,
     * writing one allocation and one ledger entry per batch touched.
     *
     * Must be called inside the transaction that already locked the product.
     *
     * @param  array<string, mixed>  $meta
     * @return array<int, StockMovementAllocation>
     */
    private function consumeFifo(
        Product $product,
        StockMovement $movement,
        int $quantity,
        int $startingBalance,
        User $actor,
        array $meta = [],
    ): array {
        $remainingToConsume = $quantity;
        $runningBalance = $startingBalance;
        $allocations = [];

        // Lock the candidate batches in FIFO order. `lockForUpdate()` on the
        // batch rows means a concurrent withdrawal for the same product queues
        // behind this one instead of double-spending a batch.
        $batches = StockBatch::query()
            ->where('product_id', $product->id)
            ->fifo()
            ->lockForUpdate()
            ->get();

        foreach ($batches as $batch) {
            if ($remainingToConsume <= 0) {
                break;
            }

            $take = min($batch->quantity_remaining, $remainingToConsume);

            if ($take <= 0) {
                continue;
            }

            $batch->quantity_remaining -= $take;
            $batch->save();

            $allocations[] = StockMovementAllocation::create([
                'business_id' => $product->business_id,
                'stock_movement_id' => $movement->id,
                'stock_batch_id' => $batch->id,
                'quantity' => $take,
                'unit_cost' => $batch->unit_cost,
            ]);

            $runningBalance -= $take;
            $remainingToConsume -= $take;

            $this->writeLedgerEntry(
                movement: $movement,
                batch: $batch,
                quantityChange: -$take,
                balanceAfter: $runningBalance,
                actor: $actor,
                supplierId: $batch->supplier_id,
                meta: $meta + [
                    'batch_number' => $batch->batch_number,
                    'batch_received_at' => $batch->received_at->toIso8601String(),
                    'fifo' => true,
                ],
            );
        }

        if ($remainingToConsume > 0) {
            // Availability was checked under a lock before we got here, so this
            // can only mean `quantity_on_hand` had drifted from the batch rows.
            // Abort rather than write an inconsistent ledger.
            throw InsufficientStockException::for(
                $product,
                $quantity,
                $quantity - $remainingToConsume
            );
        }

        return $allocations;
    }

    /**
     * Append an immutable ledger line.
     *
     * @param  array<string, mixed>  $meta
     */
    private function writeLedgerEntry(
        StockMovement $movement,
        ?StockBatch $batch,
        int $quantityChange,
        int $balanceAfter,
        User $actor,
        ?int $supplierId = null,
        array $meta = [],
    ): InventoryLedgerEntry {
        return InventoryLedgerEntry::create([
            'business_id' => $movement->business_id,
            'product_id' => $movement->product_id,
            'stock_movement_id' => $movement->id,
            'stock_batch_id' => $batch?->id,
            'supplier_id' => $supplierId ?? $movement->supplier_id,
            'type' => $movement->type,
            'quantity_change' => $quantityChange,
            'balance_after' => $balanceAfter,
            'reference' => $movement->reference,
            'notes' => $movement->notes,
            'user_id' => $actor->id,
            'meta' => $meta === [] ? null : $meta,
            'occurred_at' => $movement->occurred_at,
        ]);
    }

    /**
     * Re-read the product row inside the transaction with a write lock.
     *
     * This is what serialises concurrent movements for the same product: the
     * second request blocks here until the first commits, then sees the updated
     * quantity. The tenant scope still applies, so a product id from another
     * business simply does not resolve.
     */
    private function lockProduct(int $productId): Product
    {
        $query = Product::query()->whereKey($productId);

        // SQLite (used by the test suite) has no row-level locking; its
        // transactions are serialised at the file level, which gives the same
        // guarantee for our purposes. PostgreSQL takes a real FOR UPDATE lock.
        if (DB::getDriverName() !== 'sqlite') {
            $query->lockForUpdate();
        }

        $product = $query->first();

        if ($product === null) {
            throw (new ModelNotFoundException)->setModel(Product::class, [$productId]);
        }

        return $product;
    }

    /**
     * Authoritative availability: the sum of open batch remainders.
     *
     * Deliberately computed from the batch rows rather than trusting the
     * denormalised `products.quantity_on_hand` cache, so a drifted cache can
     * never authorise a withdrawal that the batches cannot satisfy.
     */
    public function availableQuantity(Product $product): int
    {
        return (int) StockBatch::query()
            ->where('product_id', $product->id)
            ->where('quantity_remaining', '>', 0)
            ->sum('quantity_remaining');
    }

    /**
     * Write the denormalised quantity cache, refusing any negative result.
     *
     * The column is unsigned so the database would reject it too; this check
     * turns that into a clear application-level failure instead.
     */
    private function writeQuantityOnHand(Product $product, int $quantity): void
    {
        if ($quantity < 0) {
            throw new InvalidArgumentException(
                'Refusing to write a negative quantity on hand. This indicates a bug in the inventory service.'
            );
        }

        $product->quantity_on_hand = $quantity;
        $product->saveQuietly();
    }

    /**
     * Recompute a product's quantity cache from its batches.
     *
     * A maintenance operation (exposed via `inventory:reconcile`), not part of
     * any request path.
     */
    public function reconcile(Product $product): int
    {
        return DB::transaction(function () use ($product): int {
            $locked = $this->lockProduct($product->id);
            $actual = $this->availableQuantity($locked);

            if ($actual !== $locked->quantity_on_hand) {
                $this->writeQuantityOnHand($locked, $actual);
            }

            return $actual;
        });
    }

    private function assertPositive(int $quantity): void
    {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Quantity must be greater than zero.');
        }
    }

    /**
     * Human-readable, unique-per-business batch number, e.g. `IN-ACME01-K3F9QZ`.
     */
    private function generateBatchNumber(Product $product, string $prefix = 'IN'): string
    {
        $skuPart = Str::upper(Str::limit(preg_replace('/[^A-Za-z0-9]/', '', $product->sku) ?: 'SKU', 6, ''));

        do {
            $candidate = sprintf('%s-%s-%s', $prefix, $skuPart, Str::upper(Str::random(6)));
        } while (StockBatch::query()->where('batch_number', $candidate)->exists());

        return $candidate;
    }

    /**
     * Preview which batches a withdrawal would consume, without writing
     * anything. Powers the "FIFO preview" panel on the Stock OUT screen.
     *
     * @return array{available: int, sufficient: bool, allocations: array<int, array<string, mixed>>}
     */
    public function previewFifo(Product $product, int $quantity): array
    {
        $remaining = max(0, $quantity);
        $allocations = [];

        $batches = StockBatch::query()
            ->where('product_id', $product->id)
            ->with('supplier:id,name')
            ->fifo()
            ->get();

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $take = min($batch->quantity_remaining, $remaining);
            $remaining -= $take;

            $allocations[] = [
                'batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'received_at' => $batch->received_at->toIso8601String(),
                'supplier' => $batch->supplier?->name,
                'quantity_remaining' => $batch->quantity_remaining,
                'quantity_taken' => $take,
                'depletes_batch' => $take === $batch->quantity_remaining,
            ];
        }

        $available = $this->availableQuantity($product);

        return [
            'available' => $available,
            'sufficient' => $quantity <= $available,
            'allocations' => $allocations,
        ];
    }
}
