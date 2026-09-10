<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Minimal user shape for "who did this" references. Deliberately omits email,
 * phone and role so that attribution on a movement or ledger line does not leak
 * user administration data to someone without `users.view`.
 *
 * @mixin User
 */
final class UserSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'initials' => $this->initials(),
        ];
    }
}
