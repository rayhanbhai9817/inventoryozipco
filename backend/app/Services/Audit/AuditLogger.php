<?php

declare(strict_types=1);

namespace App\Services\Audit;

use App\Enums\AuditAction;
use App\Models\AuditLog;
use App\Models\Business;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Writes the audit trail.
 *
 * Every call resolves the acting user and tenant from the request context, so
 * callers only describe *what* happened. Sensitive attributes are stripped from
 * the recorded before/after values — an audit log is not a place for password
 * hashes or tokens.
 */
final class AuditLogger
{
    /**
     * Attribute names never written to the audit trail, whatever a caller passes.
     *
     * @var array<int, string>
     */
    private const REDACTED = [
        'password',
        'password_confirmation',
        'current_password',
        'remember_token',
        'token',
        'api_token',
        'secret',
        'access_token',
        'refresh_token',
    ];

    public function __construct(private readonly Request $request) {}

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     * @param  array<string, mixed>|null  $meta
     */
    public function log(
        AuditAction $action,
        string $description,
        ?Model $auditable = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?User $actor = null,
        ?Business $business = null,
        ?array $meta = null,
    ): AuditLog {
        $actor ??= $this->resolveActor();
        $businessId = $business?->id
            ?? $actor?->business_id
            ?? TenantContext::businessId();

        return AuditLog::record([
            'business_id' => $businessId,
            'user_id' => $actor?->id,
            'user_name' => $actor?->name,
            'action' => $action->value,
            'category' => $action->category(),
            'auditable_type' => $auditable !== null ? class_basename($auditable) : null,
            'auditable_id' => $auditable?->getKey(),
            'description' => $description,
            'old_values' => $this->sanitise($oldValues),
            'new_values' => $this->sanitise($newValues),
            'meta' => $this->sanitise($meta),
            'ip_address' => $this->request->ip(),
            'user_agent' => mb_substr((string) $this->request->userAgent(), 0, 512) ?: null,
            'created_at' => now(),
        ]);
    }

    /**
     * Record the before/after of a model update, recording only the attributes
     * that actually changed.
     *
     * @param  array<int, string>  $only  Limit to these attributes; empty means all changed ones.
     */
    public function logModelChange(
        AuditAction $action,
        Model $model,
        string $description,
        array $only = [],
        ?User $actor = null,
    ): AuditLog {
        $changes = $model->getChanges();
        $original = [];

        foreach (array_keys($changes) as $key) {
            $original[$key] = $model->getOriginal($key);
        }

        if ($only !== []) {
            $changes = array_intersect_key($changes, array_flip($only));
            $original = array_intersect_key($original, array_flip($only));
        }

        // Timestamps are noise in an audit trail; `created_at` already carries it.
        unset($changes['updated_at'], $original['updated_at']);

        return $this->log(
            action: $action,
            description: $description,
            auditable: $model,
            oldValues: $original === [] ? null : $original,
            newValues: $changes === [] ? null : $changes,
            actor: $actor,
        );
    }

    /**
     * Pre-authentication events, where there may be no user and no tenant.
     *
     * @param  array<string, mixed>  $meta
     */
    public function logAnonymous(AuditAction $action, string $description, array $meta = [], ?int $businessId = null): AuditLog
    {
        return AuditLog::record([
            'business_id' => $businessId,
            'user_id' => null,
            'user_name' => null,
            'action' => $action->value,
            'category' => $action->category(),
            'description' => $description,
            'meta' => $this->sanitise($meta),
            'ip_address' => $this->request->ip(),
            'user_agent' => mb_substr((string) $this->request->userAgent(), 0, 512) ?: null,
            'created_at' => now(),
        ]);
    }

    private function resolveActor(): ?User
    {
        $user = $this->request->user();

        return $user instanceof User ? $user : null;
    }

    /**
     * @param  array<string, mixed>|null  $values
     * @return array<string, mixed>|null
     */
    private function sanitise(?array $values): ?array
    {
        if ($values === null || $values === []) {
            return null;
        }

        foreach (self::REDACTED as $key) {
            if (array_key_exists($key, $values)) {
                $values[$key] = '[redacted]';
            }
        }

        return $values;
    }
}
