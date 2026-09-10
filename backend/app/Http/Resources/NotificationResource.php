<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Notification
 */
final class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        return [
            'id' => $this->id,
            'type' => [
                'value' => $this->type->value,
                'label' => $this->type->label(),
            ],
            'severity' => $this->severity->value,
            'title' => $this->title,
            'body' => $this->body,
            'resource_type' => $this->resource_type,
            'resource_id' => $this->resource_id,
            'action_url' => $this->action_url,
            'data' => $this->data,
            'is_personal' => $this->user_id !== null,
            'is_read' => $viewer instanceof User ? $this->isReadBy($viewer) : false,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * A personal notification uses its own `read_at`; a business-wide one is read
     * when the viewer has a receipt row, which the controller eager-loads.
     */
    private function isReadBy(User $viewer): bool
    {
        if ($this->user_id === $viewer->id) {
            return $this->read_at !== null;
        }

        if (! $this->relationLoaded('readers')) {
            return false;
        }

        return $this->readers->contains('id', $viewer->id);
    }
}
