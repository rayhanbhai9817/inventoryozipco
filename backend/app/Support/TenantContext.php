<?php

declare(strict_types=1);

namespace App\Support;

use App\Http\Middleware\ResolveTenant;
use App\Models\Business;
use RuntimeException;

/**
 * Holds the business (tenant) the current request or job is operating inside.
 *
 * Nothing in the HTTP layer may set this from user input — it is populated by
 * {@see ResolveTenant} from the authenticated user's own
 * `business_id`. Console commands, seeders and tests opt out deliberately via
 * {@see self::unscoped()}.
 */
final class TenantContext
{
    private static ?Business $business = null;

    private static bool $unscoped = false;

    public static function set(Business $business): void
    {
        self::$business = $business;
        self::$unscoped = false;
    }

    public static function clear(): void
    {
        self::$business = null;
        self::$unscoped = false;
    }

    public static function business(): ?Business
    {
        return self::$business;
    }

    public static function businessId(): ?int
    {
        return self::$business?->id;
    }

    /**
     * The current business, or a hard failure. Use in service code that is
     * meaningless without a tenant.
     */
    public static function requireBusiness(): Business
    {
        return self::$business ?? throw new RuntimeException(
            'No tenant resolved for the current context. This is a bug: tenant-scoped work must run inside an authenticated request or an explicit TenantContext::forBusiness() block.'
        );
    }

    public static function isUnscoped(): bool
    {
        return self::$unscoped;
    }

    /**
     * Run a callback with tenant scoping switched off entirely.
     *
     * Reserved for migrations, seeders, platform-level maintenance commands and
     * the registration flow (which must create a business before one exists).
     *
     * @template TReturn
     *
     * @param  callable(): TReturn  $callback
     * @return TReturn
     */
    public static function unscoped(callable $callback): mixed
    {
        $previousBusiness = self::$business;
        $previousUnscoped = self::$unscoped;

        self::$business = null;
        self::$unscoped = true;

        try {
            return $callback();
        } finally {
            self::$business = $previousBusiness;
            self::$unscoped = $previousUnscoped;
        }
    }

    /**
     * Run a callback scoped to a specific business, restoring the previous
     * context afterwards.
     *
     * @template TReturn
     *
     * @param  callable(): TReturn  $callback
     * @return TReturn
     */
    public static function forBusiness(Business $business, callable $callback): mixed
    {
        $previousBusiness = self::$business;
        $previousUnscoped = self::$unscoped;

        self::set($business);

        try {
            return $callback();
        } finally {
            self::$business = $previousBusiness;
            self::$unscoped = $previousUnscoped;
        }
    }
}
