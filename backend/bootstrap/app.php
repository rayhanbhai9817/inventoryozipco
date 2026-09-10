<?php

declare(strict_types=1);

use App\Exceptions\ImmutableRecordException;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\ResolveTenant;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'permission' => EnsurePermission::class,
        ]);

        /*
         * Ordering matters here, and getting it wrong is silent.
         *
         * Route model binding (`SubstituteBindings`) resolves `{product}` by
         * querying the model — which means the global tenant scope has to be
         * active before it runs. Route-level middleware normally runs *after*
         * the group's, so without this the binding would execute with no tenant
         * resolved, the scope would fail closed, and every `/products/{id}`
         * request would 404.
         *
         * Fixing the order here rather than loosening the scope keeps the
         * fail-closed behaviour intact: a binding that somehow runs without a
         * tenant still finds nothing.
         */
        $middleware->prependToPriorityList(
            before: SubstituteBindings::class,
            prepend: ResolveTenant::class,
        );

        $middleware->prependToPriorityList(
            before: ResolveTenant::class,
            prepend: Authenticate::class,
        );

        // The API is stateless: authentication is a Sanctum bearer token, never a
        // session cookie. `statefulApi()` is deliberately NOT enabled — the
        // frontend is served from its own origin, and cookie-based auth would
        // introduce a CSRF surface this design does not need.
        $middleware->throttleApi('api');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        /*
         * Every API failure returns JSON with a human-readable `message` and,
         * where useful, a machine-readable `error` code. Internal details —
         * stack traces, SQL, class names — never reach the client in production.
         */
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Your session has expired. Please sign in again.',
                'error' => 'unauthenticated',
            ], Response::HTTP_UNAUTHORIZED);
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => $e->getMessage() !== '' && $e->getMessage() !== 'This action is unauthorized.'
                    ? $e->getMessage()
                    : 'You do not have permission to perform this action.',
                'error' => 'forbidden',
            ], Response::HTTP_FORBIDDEN);
        });

        // A cross-tenant id resolves to "not found" rather than "forbidden", so
        // the API never confirms that a record exists in another business.
        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'We could not find that record.',
                'error' => 'not_found',
            ], Response::HTTP_NOT_FOUND);
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'We could not find that record.',
                'error' => 'not_found',
            ], Response::HTTP_NOT_FOUND);
        });

        $exceptions->render(function (ImmutableRecordException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => $e->getMessage(),
                'error' => 'immutable_record',
            ], Response::HTTP_CONFLICT);
        });

        $exceptions->render(function (InvalidSignatureException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'This link is no longer valid.',
                'error' => 'invalid_signature',
            ], Response::HTTP_FORBIDDEN);
        });

        // Validation keeps Laravel's `errors` shape, which the frontend maps
        // straight onto inline field errors.
        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => $e->getMessage(),
                'error' => 'validation_failed',
                'errors' => $e->errors(),
            ], $e->status);
        });

        // Catch-all: anything unhandled becomes a friendly 500 in production,
        // while development still sees the real exception.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') || $e instanceof HttpExceptionInterface) {
                return null;
            }

            if (config('app.debug')) {
                return null;
            }

            report($e);

            return response()->json([
                'message' => 'Something went wrong on our side. Please try again.',
                'error' => 'server_error',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        });
    })->create();
