<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\NotificationResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\StockMovementResource;
use App\Services\Reports\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DashboardController extends Controller
{
    /**
     * GET /api/v1/dashboard
     *
     * One request returns everything the dashboard renders, so the page does not
     * fan out into a dozen round trips on load.
     */
    public function __invoke(Request $request, DashboardService $dashboard): JsonResponse
    {
        $this->authorize('dashboard.view');

        $days = max(7, min((int) $request->integer('days', 30), 180));
        $payload = $dashboard->forUser($request->user(), $days);

        return new JsonResponse([
            'data' => [
                'kpis' => $payload['kpis'],
                'movement_trend' => $payload['movement_trend'],
                'category_breakdown' => $payload['category_breakdown'],
                'top_movers' => $payload['top_movers'],
                'recent_stock_in' => StockMovementResource::collection($payload['recent_stock_in'])->resolve($request),
                'recent_stock_out' => StockMovementResource::collection($payload['recent_stock_out'])->resolve($request),
                'low_stock' => ProductResource::collection($payload['low_stock'])->resolve($request),
                'out_of_stock' => ProductResource::collection($payload['out_of_stock'])->resolve($request),
                'recent_activity' => AuditLogResource::collection($payload['recent_activity'])->resolve($request),
                'recent_notifications' => NotificationResource::collection($payload['recent_notifications'])->resolve($request),
                'period' => $payload['period'],
            ],
        ]);
    }
}
