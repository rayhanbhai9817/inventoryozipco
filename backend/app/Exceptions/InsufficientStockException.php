<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use RuntimeException;

/**
 * Raised when an outbound movement would drive a product's quantity below zero.
 *
 * Rendered as a 422 with machine-readable detail so the frontend can show an
 * inline, specific message ("only 14 of 20 available") rather than a generic
 * failure.
 */
final class InsufficientStockException extends RuntimeException
{
    private function __construct(
        string $message,
        public readonly int $productId,
        public readonly string $productSku,
        public readonly int $requested,
        public readonly int $available,
    ) {
        parent::__construct($message);
    }

    public static function for(Product $product, int $requested, int $available): self
    {
        return new self(
            sprintf(
                'Not enough stock for %s (%s): %d requested but only %d available.',
                $product->name,
                $product->sku,
                $requested,
                $available
            ),
            $product->id,
            $product->sku,
            $requested,
            $available
        );
    }

    public function render(): JsonResponse
    {
        return new JsonResponse([
            'message' => $this->getMessage(),
            'error' => 'insufficient_stock',
            'errors' => [
                'quantity' => [sprintf('Only %d available.', $this->available)],
            ],
            'context' => [
                'product_id' => $this->productId,
                'product_sku' => $this->productSku,
                'requested' => $this->requested,
                'available' => $this->available,
            ],
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }
}
