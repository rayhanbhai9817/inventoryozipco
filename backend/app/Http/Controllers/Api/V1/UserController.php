<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\AuditAction;
use App\Enums\NotificationType;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\PermissionDefinition;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Business user administration.
 *
 * Every query here is constrained to the acting user's own business. The
 * UserPolicy additionally prevents self-demotion, privilege escalation, and
 * removing the last active Owner.
 */
final class UserController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * GET /api/v1/users
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'role' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $users = User::query()
            // Tenant isolation: User does not use the global business scope
            // (it is the model the scope is resolved from), so it is applied here.
            ->where('business_id', $request->user()->business_id)
            ->when(
                isset($validated['search']),
                function ($query) use ($validated): void {
                    $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim((string) $validated['search'])).'%';
                    $query->where(function ($inner) use ($like): void {
                        $inner->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('job_title', 'like', $like);
                    });
                }
            )
            ->when(
                isset($validated['role']),
                fn ($query) => $query->where('role', $validated['role'])
            )
            ->when(
                array_key_exists('is_active', $validated) && $validated['is_active'] !== null,
                fn ($query) => $query->where('is_active', (bool) $validated['is_active'])
            )
            ->orderByRaw("CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END")
            ->orderBy('name')
            ->paginate((int) ($validated['per_page'] ?? 25))
            ->withQueryString();

        return UserResource::collection($users);
    }

    /**
     * POST /api/v1/users
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $actor = $request->user();

        $user = DB::transaction(function () use ($request, $actor): User {
            /** @var User $user */
            $user = User::create([
                'business_id' => $actor->business_id,
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value(),
                'password' => $request->string('password')->value(),
                'role' => $request->string('role')->value(),
                'job_title' => $request->input('job_title'),
                'phone' => $request->input('phone'),
                'is_active' => $request->boolean('is_active', true),
                'must_change_password' => $request->boolean('must_change_password', true),
                'invited_at' => now(),
                'invited_by' => $actor->id,
            ]);

            if ($request->has('permissions')) {
                $this->syncPermissionOverrides($user, (array) $request->input('permissions', []));
            }

            $this->audit->log(
                action: AuditAction::UserInvited,
                description: sprintf('Added %s (%s) as %s', $user->name, $user->email, $user->role->label()),
                auditable: $user,
                newValues: ['email' => $user->email, 'role' => $user->role->value],
                actor: $actor,
            );

            return $user;
        });

        $this->notifications->notifyUser(
            user: $user,
            type: NotificationType::UserInvited,
            title: sprintf('Welcome to %s on Fast Sold', $actor->business?->name ?? 'your business'),
            body: 'Your account has been created. You can change your password in Settings → Security.',
            actionUrl: '/settings/security',
        );

        return (new UserResource($user->fresh()))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * GET /api/v1/users/{user}
     */
    public function show(User $user): UserResource
    {
        $this->authorize('view', $user);

        return (new UserResource($user->load('business')))->withPermissions();
    }

    /**
     * PATCH /api/v1/users/{user}
     */
    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        $this->authorize('update', $user);

        $actor = $request->user();

        DB::transaction(function () use ($request, $user, $actor): void {
            // A role change is authorised separately and more strictly than a
            // profile edit.
            if ($request->has('role')) {
                $newRole = Role::from($request->string('role')->value());

                if ($newRole !== $user->role) {
                    $this->authorize('assignRole', [$user, $newRole]);

                    $previous = $user->role;
                    $user->role = $newRole;

                    $this->audit->log(
                        action: AuditAction::UserRoleChanged,
                        description: sprintf('Changed %s from %s to %s', $user->name, $previous->label(), $newRole->label()),
                        auditable: $user,
                        oldValues: ['role' => $previous->value],
                        newValues: ['role' => $newRole->value],
                        actor: $actor,
                    );

                    $this->notifications->notifyUser(
                        user: $user,
                        type: NotificationType::RoleChanged,
                        title: sprintf('Your role is now %s', $newRole->label()),
                        body: $newRole->description(),
                    );
                }
            }

            if ($request->has('is_active') && $request->boolean('is_active') !== $user->is_active) {
                if (! $request->boolean('is_active')) {
                    $this->authorize('deactivate', $user);
                }

                $user->is_active = $request->boolean('is_active');

                $this->audit->log(
                    action: $user->is_active ? AuditAction::UserActivated : AuditAction::UserDeactivated,
                    description: sprintf('%s %s', $user->is_active ? 'Activated' : 'Deactivated', $user->name),
                    auditable: $user,
                    newValues: ['is_active' => $user->is_active],
                    actor: $actor,
                );

                // Deactivating revokes API access immediately rather than at
                // token expiry.
                if (! $user->is_active) {
                    $user->tokens()->delete();
                }
            }

            $user->fill($request->safe()->only(['name', 'email', 'job_title', 'phone', 'must_change_password']));

            if ($request->filled('password')) {
                $user->password = $request->string('password')->value();
                $user->must_change_password = true;
                $user->tokens()->delete();
            }

            if ($user->isDirty()) {
                $changed = array_keys($user->getDirty());
                $user->save();

                // Role and activation changes are already audited above with
                // their own action types.
                $profileChanges = array_diff($changed, ['role', 'is_active', 'password']);

                if ($profileChanges !== []) {
                    $this->audit->log(
                        action: AuditAction::UserUpdated,
                        description: sprintf('Updated %s', $user->name),
                        auditable: $user,
                        newValues: array_intersect_key($user->getChanges(), array_flip($profileChanges)),
                        actor: $actor,
                    );
                }
            }

            if ($request->has('permissions')) {
                $this->authorize('managePermissions', $user);
                $this->syncPermissionOverrides($user, (array) $request->input('permissions', []));

                $this->audit->log(
                    action: AuditAction::UserPermissionsChanged,
                    description: sprintf('Updated permissions for %s', $user->name),
                    auditable: $user,
                    newValues: ['permissions' => $request->input('permissions')],
                    actor: $actor,
                );
            }
        });

        return (new UserResource($user->fresh()))->withPermissions();
    }

    /**
     * DELETE /api/v1/users/{user}
     *
     * Soft delete, so audit and ledger attribution for what this person did
     * remains resolvable.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorize('delete', $user);

        $snapshot = $user->only(['name', 'email', 'role']);
        $user->tokens()->delete();
        $user->forceFill(['is_active' => false])->save();
        $user->delete();

        $this->audit->log(
            action: AuditAction::UserDeactivated,
            description: sprintf('Removed %s (%s)', $snapshot['name'], $snapshot['email']),
            oldValues: $snapshot,
            actor: $request->user(),
        );

        return new JsonResponse(['message' => 'User removed.']);
    }

    /**
     * GET /api/v1/users/{user}/activity
     */
    public function activity(Request $request, User $user): AnonymousResourceCollection
    {
        $this->authorize('view', $user);

        $logs = AuditLog::query()
            ->where('user_id', $user->id)
            ->latest('created_at')
            ->latest('id')
            ->paginate(min(max((int) $request->integer('per_page', 25), 5), 100));

        return AuditLogResource::collection($logs);
    }

    /**
     * Replace a user's per-permission overrides.
     *
     * Anything in the role's default set is left implicit; only deviations are
     * stored, so a later change to the role's matrix still reaches this user.
     *
     * @param  array<int, string>  $requestedKeys
     */
    private function syncPermissionOverrides(User $user, array $requestedKeys): void
    {
        $requested = array_values(array_unique(array_map('strval', $requestedKeys)));
        $roleDefaults = $user->role->defaultPermissions();
        $catalogue = PermissionDefinition::query()->pluck('id', 'key');

        $payload = [];

        foreach ($catalogue as $key => $id) {
            $key = (string) $key;
            $wanted = in_array($key, $requested, true);
            $isDefault = in_array($key, $roleDefaults, true);

            if ($wanted === $isDefault) {
                continue; // Matches the role default — store nothing.
            }

            $payload[(int) $id] = ['granted' => $wanted, 'updated_at' => now(), 'created_at' => now()];
        }

        $user->permissionOverrides()->sync($payload);
        $user->forgetCachedPermissions();
    }
}
