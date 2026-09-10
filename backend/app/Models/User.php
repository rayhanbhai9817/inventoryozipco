<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\NotificationType;
use App\Enums\Permission;
use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property int|null $business_id
 * @property string $name
 * @property string $email
 * @property Role $role
 * @property bool $is_active
 * @property array<string, bool>|null $notification_preferences
 * @property-read Business|null $business
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens;

    use HasFactory;
    use Notifiable;
    use SoftDeletes;

    protected $fillable = [
        'business_id',
        'name',
        'email',
        'password',
        'role',
        'job_title',
        'phone',
        'avatar_path',
        'is_active',
        'invited_at',
        'invited_by',
        'must_change_password',
        'notification_preferences',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Cache of the resolved effective permission keys for this request.
     *
     * @var array<int, string>|null
     */
    private ?array $effectivePermissions = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'invited_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
            'notification_preferences' => 'array',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'invited_by');
    }

    /**
     * Per-user permission overrides layered on top of the role's set.
     */
    public function permissionOverrides(): BelongsToMany
    {
        return $this->belongsToMany(PermissionDefinition::class, 'permission_user', 'user_id', 'permission_id')
            ->withPivot('granted');
    }

    /**
     * The business-scoped role definition that carries this user's permission
     * set. Resolved per user rather than as an Eloquent relationship because the
     * lookup is keyed on (business_id, role).
     */
    public function roleDefinition(): ?RoleDefinition
    {
        if ($this->business_id === null) {
            return null;
        }

        return RoleDefinition::query()
            ->where('business_id', $this->business_id)
            ->where('key', $this->role->value)
            ->first();
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function isOwner(): bool
    {
        return $this->role === Role::Owner;
    }

    /**
     * The authoritative permission check. Used by policies, the
     * `permission:` middleware and the `/auth/me` payload the frontend
     * renders navigation from.
     */
    public function hasPermission(Permission|string $permission): bool
    {
        // An owner always holds every permission inside their own business.
        if ($this->role === Role::Owner) {
            return true;
        }

        $key = $permission instanceof Permission ? $permission->value : $permission;

        return in_array($key, $this->effectivePermissions(), true);
    }

    public function hasAnyPermission(Permission|string ...$permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Role permissions, plus explicit user grants, minus explicit user
     * revocations.
     *
     * @return array<int, string>
     */
    public function effectivePermissions(): array
    {
        if ($this->effectivePermissions !== null) {
            return $this->effectivePermissions;
        }

        if ($this->role === Role::Owner) {
            return $this->effectivePermissions = Permission::keys();
        }

        $roleDefinition = RoleDefinition::query()
            ->where('business_id', $this->business_id)
            ->where('key', $this->role->value)
            ->with('permissions:id,key')
            ->first();

        $keys = $roleDefinition
            ? $roleDefinition->permissions->pluck('key')->all()
            // No stored role row yet (e.g. a business created before a role
            // sync). Fall back to the enum defaults rather than denying all.
            : $this->role->defaultPermissions();

        $granted = [];
        $revoked = [];

        foreach ($this->permissionOverrides as $override) {
            if ($override->pivot->granted) {
                $granted[] = $override->key;
            } else {
                $revoked[] = $override->key;
            }
        }

        $effective = array_values(array_diff(array_unique([...$keys, ...$granted]), $revoked));

        // Owner-only permissions can never be reached by a non-owner, whatever
        // the stored matrix says.
        $effective = array_values(array_filter(
            $effective,
            static fn (string $key): bool => ! (Permission::tryFrom($key)?->isOwnerOnly() ?? false)
        ));

        return $this->effectivePermissions = $effective;
    }

    public function forgetCachedPermissions(): void
    {
        $this->effectivePermissions = null;
    }

    /**
     * Whether this user wants in-app notifications of the given type.
     */
    public function wantsNotification(NotificationType $type): bool
    {
        if (! $type->isMutable()) {
            return true;
        }

        return (bool) ($this->notification_preferences[$type->value] ?? true);
    }

    public function initials(): string
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [];
        $first = mb_substr((string) ($parts[0] ?? ''), 0, 1);
        $last = count($parts) > 1 ? mb_substr((string) end($parts), 0, 1) : '';

        return mb_strtoupper($first.$last) ?: '?';
    }
}
