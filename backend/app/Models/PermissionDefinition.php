<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Permission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A row in the global permission catalogue, seeded from {@see Permission}.
 *
 * Named `PermissionDefinition` so the class does not collide with the
 * `Permission` enum or Laravel's `Gate` vocabulary.
 *
 * @property int $id
 * @property string $key
 * @property string $name
 * @property string $group
 * @property bool $owner_only
 */
class PermissionDefinition extends Model
{
    protected $table = 'permissions';

    protected $fillable = ['key', 'name', 'group', 'owner_only'];

    protected function casts(): array
    {
        return [
            'owner_only' => 'boolean',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(RoleDefinition::class, 'permission_role', 'permission_id', 'role_id');
    }
}
