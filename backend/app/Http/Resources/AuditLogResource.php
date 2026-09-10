<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AuditLog
 */
final class AuditLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => [
                'value' => $this->action->value,
                'label' => $this->action->label(),
            ],
            'category' => $this->category,
            'description' => $this->description,
            'resource' => [
                'type' => $this->auditable_type,
                'id' => $this->auditable_id,
            ],
            'old_values' => $this->old_values,
            'new_values' => $this->new_values,
            'meta' => $this->meta,
            'ip_address' => $this->ip_address,
            'user' => [
                'id' => $this->user_id,
                'name' => $this->user_name,
            ],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
