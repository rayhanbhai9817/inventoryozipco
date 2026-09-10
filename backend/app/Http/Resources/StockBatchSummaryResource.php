<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\StockBatch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compact batch shape for nested references. `received_at` is included because
 * it is what makes a FIFO allocation legible ("took 10 from the batch received
 * on 3 Jan"). Matching eager loads select `id, batch_number, received_at`.
 *
 * @mixin StockBatch
 */
final class StockBatchSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batch_number' => $this->batch_number,
            'received_at' => $this->received_at?->toIso8601String(),
        ];
    }
}
