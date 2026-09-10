<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

final class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    /**
     * GET /api/v1/notifications
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('notifications.view');

        $user = $request->user();

        $notifications = Notification::query()
            ->visibleTo($user)
            // Eager-loaded so the resource can report read state for
            // business-wide notifications without an N+1.
            ->with(['readers' => fn ($query) => $query->where('users.id', $user->id)])
            ->ofType($request->string('type')->value() ?: null)
            ->when(
                $request->boolean('unread_only'),
                fn ($query) => $query->unreadFor($user)
            )
            ->latest('created_at')
            ->latest('id')
            ->paginate(min(max((int) $request->integer('per_page', 25), 5), 100))
            ->withQueryString();

        return NotificationResource::collection($notifications)->additional([
            'meta' => ['unread_count' => $this->notifications->unreadCountFor($user)],
        ]);
    }

    /**
     * GET /api/v1/notifications/unread-count — drives the bell badge.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $this->authorize('notifications.view');

        return new JsonResponse([
            'data' => ['unread_count' => $this->notifications->unreadCountFor($request->user())],
        ]);
    }

    /**
     * POST /api/v1/notifications/{notification}/read
     */
    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        $this->authorize('notifications.view');

        // A personal notification addressed to someone else is not readable by
        // this user, even inside the same business.
        if ($notification->user_id !== null && $notification->user_id !== $request->user()->id) {
            return new JsonResponse(['message' => 'Notification not found.'], Response::HTTP_NOT_FOUND);
        }

        $this->notifications->markRead($notification, $request->user());

        return new JsonResponse([
            'message' => 'Marked as read.',
            'data' => ['unread_count' => $this->notifications->unreadCountFor($request->user())],
        ]);
    }

    /**
     * POST /api/v1/notifications/read-all
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $this->authorize('notifications.view');

        $count = $this->notifications->markAllRead($request->user());

        return new JsonResponse([
            'message' => $count === 0 ? 'Nothing to mark.' : sprintf('%d notifications marked as read.', $count),
            'data' => ['marked' => $count, 'unread_count' => 0],
        ]);
    }
}
