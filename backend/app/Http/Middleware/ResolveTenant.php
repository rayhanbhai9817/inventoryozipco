<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Scopes\BusinessScope;
use App\Models\User;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Establishes the tenant for the request from the authenticated user.
 *
 * The business is taken from `users.business_id` and from nowhere else — not a
 * header, not a query parameter, not a subdomain. A client therefore has no
 * mechanism by which to ask for another tenant's data; the global
 * {@see BusinessScope} then confines every query to it.
 *
 * Also refuses deactivated users and deactivated businesses, so revoking access
 * takes effect on the next request even if the API token is still valid.
 */
final class ResolveTenant
{
    public function handle(Request $request, Closure $next): SymfonyResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $this->deny('Unauthenticated.', Response::HTTP_UNAUTHORIZED);
        }

        if (! $user->is_active) {
            return $this->deny(
                'Your account has been deactivated. Contact your business owner for access.',
                Response::HTTP_FORBIDDEN
            );
        }

        $business = $user->business;

        if ($business === null) {
            return $this->deny(
                'Your account is not linked to a business. Contact support.',
                Response::HTTP_FORBIDDEN
            );
        }

        if (! $business->is_active) {
            return $this->deny(
                'This business account is suspended.',
                Response::HTTP_FORBIDDEN
            );
        }

        TenantContext::set($business);

        try {
            return $next($request);
        } finally {
            // Workers reuse the process between requests; never leak a tenant.
            TenantContext::clear();
        }
    }

    private function deny(string $message, int $status): JsonResponse
    {
        return new JsonResponse(['message' => $message], $status);
    }
}
