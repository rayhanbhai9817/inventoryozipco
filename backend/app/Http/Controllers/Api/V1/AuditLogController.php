<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only access to the audit trail.
 *
 * There is deliberately no store, update or destroy route: the audit log is
 * append-only, written only by {@see AuditLogger}, and the
 * model itself refuses updates and deletes.
 */
final class AuditLogController extends Controller
{
    /**
     * GET /api/v1/audit-logs
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('audit-logs.view');

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'action' => ['nullable', 'string', 'max:64'],
            'category' => ['nullable', 'string', 'max:32'],
            'user_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:200'],
        ]);

        $logs = AuditLog::query()
            ->search($validated['search'] ?? null)
            ->between($validated['date_from'] ?? null, $validated['date_to'] ?? null)
            ->when(
                isset($validated['action']),
                fn ($query) => $query->where('action', $validated['action'])
            )
            ->when(
                isset($validated['category']),
                fn ($query) => $query->where('category', $validated['category'])
            )
            ->when(
                isset($validated['user_id']),
                fn ($query) => $query->where('user_id', $validated['user_id'])
            )
            ->latest('created_at')
            ->latest('id')
            ->paginate((int) ($validated['per_page'] ?? 30))
            ->withQueryString();

        return AuditLogResource::collection($logs);
    }

    /**
     * GET /api/v1/audit-logs/filters — the option lists for the filter bar.
     */
    public function filters(): JsonResponse
    {
        $this->authorize('audit-logs.view');

        $actions = [];

        foreach (AuditAction::cases() as $action) {
            $actions[] = [
                'value' => $action->value,
                'label' => $action->label(),
                'category' => $action->category(),
            ];
        }

        return new JsonResponse([
            'data' => [
                'actions' => $actions,
                'categories' => array_values(array_unique(array_column($actions, 'category'))),
                'users' => AuditLog::query()
                    ->whereNotNull('user_id')
                    ->select(['user_id', 'user_name'])
                    ->distinct()
                    ->orderBy('user_name')
                    ->get()
                    ->map(static fn (AuditLog $log): array => [
                        'id' => $log->user_id,
                        'name' => $log->user_name,
                    ])
                    ->all(),
            ],
        ]);
    }
}
