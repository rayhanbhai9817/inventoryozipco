<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Route-level permission gate: `->middleware('permission:products.manage')`.
 *
 * Several permissions may be listed; holding any one of them is enough, which
 * covers routes reachable from more than one capability.
 *
 * This is a coarse first gate. Per-record authorisation still runs through the
 * policies, so both layers have to agree before a request succeeds.
 */
final class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): SymfonyResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return new JsonResponse(['message' => 'Unauthenticated.'], Response::HTTP_UNAUTHORIZED);
        }

        if ($permissions !== [] && ! $user->hasAnyPermission(...$permissions)) {
            return new JsonResponse([
                'message' => 'You do not have permission to perform this action.',
                'error' => 'forbidden',
                'required_permissions' => array_values($permissions),
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
