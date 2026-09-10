<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing
|--------------------------------------------------------------------------
|
| The Next.js frontend and the Laravel API are separate deployments on
| separate origins, so the API must explicitly allow the frontend's origin.
|
| Origins come from the FRONTEND_URL environment variable (comma-separated for
| multiple environments). There is no wildcard fallback in production: an
| unlisted origin is refused rather than silently allowed.
|
*/

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('FRONTEND_URL', 'http://localhost:3000'))
)));

return [

    'paths' => ['api/*', 'up'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'X-Requested-With',
    ],

    // The frontend reads the filename off CSV exports.
    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 3600,

    // Token auth: no cookies cross the origin boundary.
    'supports_credentials' => false,

];
