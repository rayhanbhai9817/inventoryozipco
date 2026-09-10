<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\Role;
use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A business's editable definition of one of the three roles.
 *
 * Each business gets its own rows at registration, so an Owner can widen or
 * narrow what their Managers and Staff can do without affecting any other
 * tenant.
 *
 * @property int $id
 * @property int $business_id
 * @property string $key
 * @property string $name
 * @property bool $is_system
 * @property-read Collection<int, PermissionDefinition> $permissions
 */
class RoleDefinition extends Model
{
    use BelongsToBusiness;

    protected $table = 'roles';

    protected $fillable = ['business_id', 'key', 'name', 'description', 'is_system'];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
        ];
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(PermissionDefinition::class, 'permission_role', 'role_id', 'permission_id');
    }

    public function role(): ?Role
    {
        return Role::tryFrom($this->key);
    }

    /**
     * Users carrying this role, matched on the role key within the business.
     */
    public function users()
    {
        return User::query()
            ->where('business_id', $this->business_id)
            ->where('role', $this->key);
    }
}
