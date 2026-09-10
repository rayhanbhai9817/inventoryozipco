<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/**
 * Base controller.
 *
 * Brings in `AuthorizesRequests` so every controller can call
 * `$this->authorize(...)` against the policies. Policy checks are not optional
 * decoration here: the route middleware gates the coarse permission, and the
 * policy decides the specific record.
 */
abstract class Controller
{
    use AuthorizesRequests;
}
