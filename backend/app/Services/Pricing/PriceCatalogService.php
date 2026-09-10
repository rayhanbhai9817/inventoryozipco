<?php

declare(strict_types=1);

namespace App\Services\Pricing;

use App\Enums\AuditAction;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductPriceHistory;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Maintains the product price / reference catalogue.
 *
 * This service is intentionally isolated from the inventory engine. It reads and
 * writes only `product_prices` and `product_price_history`; it never touches
 * batches, movements, the ledger or `products.quantity_on_hand`. Changing a
 * price can therefore never change a quantity — a rule the test suite asserts
 * directly.
 */
final class PriceCatalogService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Record a reference price for a product.
     *
     * Writes the current row and appends to history, closing the previous
     * history window. Both happen in one transaction so the history can never
     * contain two open windows.
     *
     * @param  array{reference_price: string|float|int, currency?: string|null, effective_from?: string|null, source?: string|null, notes?: string|null, image_path?: string|null}  $attributes
     */
    public function setPrice(Product $product, array $attributes, User $actor): ProductPrice
    {
        return DB::transaction(function () use ($product, $attributes, $actor): ProductPrice {
            $existing = ProductPrice::query()->where('product_id', $product->id)->first();
            $effectiveFrom = isset($attributes['effective_from'])
                ? Carbon::parse((string) $attributes['effective_from'])->startOfDay()
                : Carbon::now()->startOfDay();

            $currency = $attributes['currency'] ?? $existing?->currency ?? $product->business?->currency ?? 'USD';
            $newPrice = (string) $attributes['reference_price'];
            $previousPrice = $existing?->reference_price;

            // Close the currently open history window. `effective_to` is the only
            // field ever written to an existing history row.
            ProductPriceHistory::query()
                ->where('product_id', $product->id)
                ->whereNull('effective_to')
                ->update(['effective_to' => $effectiveFrom]);

            ProductPriceHistory::create([
                'business_id' => $product->business_id,
                'product_id' => $product->id,
                'reference_price' => $newPrice,
                'previous_price' => $previousPrice,
                'currency' => $currency,
                'effective_from' => $effectiveFrom,
                'effective_to' => null,
                'source' => $attributes['source'] ?? null,
                'image_path' => $attributes['image_path'] ?? null,
                'notes' => $attributes['notes'] ?? null,
                'recorded_by' => $actor->id,
            ]);

            $price = ProductPrice::query()->updateOrCreate(
                ['business_id' => $product->business_id, 'product_id' => $product->id],
                [
                    'reference_price' => $newPrice,
                    'currency' => $currency,
                    'effective_from' => $effectiveFrom,
                    'source' => $attributes['source'] ?? null,
                    'image_path' => $attributes['image_path'] ?? null,
                    'notes' => $attributes['notes'] ?? null,
                    'updated_by' => $actor->id,
                ],
            );

            $this->audit->log(
                action: $existing === null ? AuditAction::PriceCreated : AuditAction::PriceUpdated,
                description: sprintf(
                    '%s reference price for %s (%s): %s %s',
                    $existing === null ? 'Set' : 'Updated',
                    $product->name,
                    $product->sku,
                    $currency,
                    $newPrice
                ),
                auditable: $product,
                oldValues: $previousPrice !== null ? ['reference_price' => $previousPrice] : null,
                newValues: ['reference_price' => $newPrice, 'currency' => $currency, 'effective_from' => $effectiveFrom->toDateString()],
                actor: $actor,
            );

            return $price->refresh()->load('product');
        });
    }

    /**
     * Remove a product from the catalogue. History is retained — it is a record
     * of what the price was, and deleting the current row does not unmake that.
     */
    public function removePrice(Product $product, User $actor): void
    {
        DB::transaction(function () use ($product, $actor): void {
            $price = ProductPrice::query()->where('product_id', $product->id)->first();

            if ($price === null) {
                return;
            }

            $recorded = $price->reference_price;

            ProductPriceHistory::query()
                ->where('product_id', $product->id)
                ->whereNull('effective_to')
                ->update(['effective_to' => Carbon::now()->startOfDay()]);

            $price->delete();

            $this->audit->log(
                action: AuditAction::PriceDeleted,
                description: sprintf('Removed reference price for %s (%s)', $product->name, $product->sku),
                auditable: $product,
                oldValues: ['reference_price' => $recorded],
                actor: $actor,
            );
        });
    }
}
