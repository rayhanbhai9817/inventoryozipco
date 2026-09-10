<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterBusinessRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Notifications\NotificationService;
use App\Services\Tenancy\BusinessRegistrationService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Authentication and tenant registration.
 *
 * Tokens are Sanctum personal access tokens, which keeps the API stateless and
 * lets the frontend run on a different origin to the backend — the deployment
 * shape described in docs/DEPLOYMENT.md.
 */
final class AuthController extends Controller
{
    /**
     * A valid bcrypt hash of a value no user can have. Compared against when the
     * submitted email matches no account, so that the "unknown address" and
     * "wrong password" paths take the same time.
     */
    private const DUMMY_HASH = '$2y$12$jVmJ7Q0KQ9Qq8fG2rJZ3oOqFQ6h4FkKxPq2bLwVn5YyZ3tUzD1aKe';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * POST /api/v1/auth/register
     *
     * Creates a business and its first Owner, then returns a token so the user
     * lands straight in their new dashboard.
     */
    public function register(RegisterBusinessRequest $request, BusinessRegistrationService $service): JsonResponse
    {
        $result = $service->register($request->safe()->only([
            'business_name', 'name', 'email', 'password', 'industry', 'timezone', 'currency',
        ]));

        /** @var User $user */
        $user = $result['user'];

        $token = $user->createToken('web', ['*'])->plainTextToken;

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->saveQuietly();

        return new JsonResponse([
            'message' => 'Your business is ready.',
            'token' => $token,
            'user' => (new UserResource($user->load('business')))->withPermissions()->toArray($request),
        ], Response::HTTP_CREATED);
    }

    /**
     * POST /api/v1/auth/login
     *
     * Throttled per email+IP on top of the route's rate limiter, so a single
     * account cannot be brute-forced from a rotating IP pool and a single IP
     * cannot enumerate many accounts.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $throttleKey = Str::transliterate(Str::lower($request->string('email')->value()).'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, maxAttempts: 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            throw ValidationException::withMessages([
                'email' => sprintf('Too many sign-in attempts. Try again in %d seconds.', $seconds),
            ])->status(Response::HTTP_TOO_MANY_REQUESTS);
        }

        $user = User::query()
            ->where('email', $request->string('email')->value())
            ->first();

        // Always run one hash comparison, against a dummy hash when the address
        // is unknown, so the response time does not reveal whether an account
        // exists. The failure message is identical either way.
        $passwordMatches = Hash::check(
            (string) $request->input('password'),
            $user->password ?? self::DUMMY_HASH,
        );

        if ($user === null || ! $passwordMatches) {
            RateLimiter::hit($throttleKey, decaySeconds: 300);

            $this->audit->logAnonymous(
                AuditAction::LoginFailed,
                sprintf('Failed sign-in attempt for %s', $request->string('email')->value()),
                ['email' => $request->string('email')->value()],
                $user?->business_id,
            );

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        if (! $user->is_active) {
            RateLimiter::hit($throttleKey, decaySeconds: 300);

            throw ValidationException::withMessages([
                'email' => 'This account has been deactivated. Contact your business owner.',
            ]);
        }

        if ($user->business === null || ! $user->business->is_active) {
            throw ValidationException::withMessages([
                'email' => 'This business account is not active.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        // A fresh sign-in invalidates previous tokens for the same device name,
        // so an old token left on a shared machine stops working.
        $user->tokens()->where('name', $request->deviceName())->delete();

        $token = $user->createToken(
            $request->deviceName(),
            ['*'],
            // "Remember me" extends the token's life; otherwise it is short.
            $request->remember() ? now()->addDays(30) : now()->addHours(12),
        )->plainTextToken;

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->saveQuietly();

        return TenantContext::forBusiness($user->business, function () use ($request, $user, $token): JsonResponse {
            $this->audit->log(
                action: AuditAction::Login,
                description: sprintf('%s signed in', $user->name),
                auditable: $user,
                actor: $user,
                business: $user->business,
            );

            return new JsonResponse([
                'message' => 'Signed in.',
                'token' => $token,
                'user' => (new UserResource($user->load('business')))->withPermissions()->toArray($request),
            ]);
        });
    }

    /**
     * GET /api/v1/auth/me
     *
     * The frontend's source of truth for who the user is and what they may do.
     * Navigation and action visibility are derived from `permissions` here — but
     * every one of those permissions is re-checked server-side on use.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return new JsonResponse([
            'user' => (new UserResource($user->load('business')))->withPermissions()->toArray($request),
            'unread_notifications' => $this->notifications->unreadCountFor($user),
        ]);
    }

    /**
     * POST /api/v1/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $this->audit->log(
            action: AuditAction::Logout,
            description: sprintf('%s signed out', $user->name),
            auditable: $user,
            actor: $user,
        );

        $token = $user->currentAccessToken();

        if ($token !== null && method_exists($token, 'delete')) {
            $token->delete();
        }

        return new JsonResponse(['message' => 'Signed out.']);
    }

    /**
     * POST /api/v1/auth/logout-all — revokes every token for the account.
     */
    public function logoutAll(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $revoked = $user->tokens()->count();
        $user->tokens()->delete();

        $this->audit->log(
            action: AuditAction::Logout,
            description: sprintf('%s signed out of all devices', $user->name),
            auditable: $user,
            actor: $user,
            meta: ['tokens_revoked' => $revoked],
        );

        return new JsonResponse(['message' => 'Signed out of all devices.', 'tokens_revoked' => $revoked]);
    }
}
