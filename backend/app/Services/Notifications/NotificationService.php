<?php

declare(strict_types=1);

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Enums\Permission;
use App\Enums\StockStatus;
use App\Models\Notification;
use App\Models\NotificationRead;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Raises and reads in-app notifications.
 *
 * Stock-level alerts are deduplicated: while a product is still low or out of
 * stock, the existing open alert is left in place rather than a new one being
 * raised on every movement. When the product recovers, the stale alert is
 * resolved so the bell does not accumulate noise.
 */
final class NotificationService
{
    /**
     * How long an unread low/out-of-stock alert suppresses a duplicate.
     */
    private const DEDUPE_WINDOW_HOURS = 24;

    /**
     * Raise (or suppress) stock-level alerts for a product after a movement.
     */
    public function evaluateStockLevel(Product $product): void
    {
        $status = $product->stockStatus();

        if ($status === StockStatus::OutOfStock) {
            $this->resolveOpenAlerts($product, [NotificationType::LowStock]);

            $this->raiseBusinessWide(
                type: NotificationType::OutOfStock,
                title: sprintf('%s is out of stock', $product->name),
                body: sprintf('%s (%s) has no remaining stock. Record a stock in to replenish it.', $product->name, $product->sku),
                product: $product,
                dedupe: true,
            );

            return;
        }

        if ($status === StockStatus::LowStock) {
            $this->resolveOpenAlerts($product, [NotificationType::OutOfStock]);

            $this->raiseBusinessWide(
                type: NotificationType::LowStock,
                title: sprintf('%s is running low', $product->name),
                body: sprintf(
                    '%s (%s) is down to %d %s, at or below its minimum of %d.',
                    $product->name,
                    $product->sku,
                    $product->quantity_on_hand,
                    $product->unit->abbreviation(),
                    $product->minimum_stock_level
                ),
                product: $product,
                dedupe: true,
            );

            return;
        }

        // Healthy again: clear any open low/out-of-stock alerts for this product.
        $this->resolveOpenAlerts($product, [NotificationType::LowStock, NotificationType::OutOfStock]);
    }

    public function stockInRecorded(Product $product, StockMovement $movement): void
    {
        $this->raiseBusinessWide(
            type: NotificationType::StockInRecorded,
            title: sprintf('Stock in recorded for %s', $product->name),
            body: sprintf(
                '%d %s received%s. Balance is now %d.',
                $movement->quantity,
                $product->unit->abbreviation(),
                $movement->reference !== null ? ' against '.$movement->reference : '',
                $movement->balance_after
            ),
            product: $product,
            actionUrl: '/stock-in',
        );

        $this->flagMissingReferenceData($product);
    }

    public function stockOutRecorded(Product $product, StockMovement $movement): void
    {
        $this->raiseBusinessWide(
            type: NotificationType::StockOutRecorded,
            title: sprintf('Stock out recorded for %s', $product->name),
            body: sprintf(
                '%d %s issued%s. Balance is now %d.',
                $movement->quantity,
                $product->unit->abbreviation(),
                $movement->reference !== null ? ' against '.$movement->reference : '',
                $movement->balance_after
            ),
            product: $product,
            actionUrl: '/stock-out',
        );
    }

    public function inventoryAdjusted(Product $product, StockMovement $movement): void
    {
        $this->raiseBusinessWide(
            type: NotificationType::InventoryAdjusted,
            title: sprintf('%s adjusted', $product->name),
            body: sprintf(
                '%+d %s — %s. Balance is now %d.',
                $movement->signedQuantity(),
                $product->unit->abbreviation(),
                $movement->reason ?? 'no reason given',
                $movement->balance_after
            ),
            product: $product,
            actionUrl: sprintf('/products/%d', $product->id),
        );
    }

    /**
     * Warn when a product lacks the reference data the business needs to
     * reorder or quote it.
     */
    public function flagMissingReferenceData(Product $product): void
    {
        if (! $product->suppliers()->exists()) {
            $this->raiseBusinessWide(
                type: NotificationType::MissingSupplier,
                title: sprintf('%s has no supplier', $product->name),
                body: sprintf('Link at least one supplier to %s so reordering and supplier reports are complete.', $product->sku),
                product: $product,
                actionUrl: sprintf('/products/%d', $product->id),
                dedupe: true,
            );
        }

        if (! $product->price()->exists()) {
            $this->raiseBusinessWide(
                type: NotificationType::MissingPriceReference,
                title: sprintf('%s has no reference price', $product->name),
                body: sprintf('Add %s to the price catalogue to keep reference pricing complete.', $product->sku),
                product: $product,
                actionUrl: '/price-catalog',
                dedupe: true,
            );
        }
    }

    /**
     * Notify a specific user (invitations, role changes).
     *
     * @param  array<string, mixed>  $data
     */
    public function notifyUser(
        User $user,
        NotificationType $type,
        string $title,
        ?string $body = null,
        ?string $actionUrl = null,
        array $data = [],
    ): ?Notification {
        if (! $user->wantsNotification($type)) {
            return null;
        }

        return Notification::create([
            'business_id' => $user->business_id,
            'user_id' => $user->id,
            'type' => $type,
            'severity' => $type->severity(),
            'title' => $title,
            'body' => $body,
            'action_url' => $actionUrl,
            'data' => $data === [] ? null : $data,
        ]);
    }

    /**
     * Raise a notification visible to everyone in the business.
     */
    private function raiseBusinessWide(
        NotificationType $type,
        string $title,
        ?string $body,
        ?Product $product = null,
        ?string $actionUrl = null,
        bool $dedupe = false,
    ): ?Notification {
        if ($dedupe && $product !== null && $this->hasOpenAlert($type, $product)) {
            return null;
        }

        return Notification::create([
            'user_id' => null,
            'type' => $type,
            'severity' => $type->severity(),
            'title' => $title,
            'body' => $body,
            'resource_type' => $product !== null ? 'product' : null,
            'resource_id' => $product?->id,
            'action_url' => $actionUrl ?? ($product !== null ? sprintf('/products/%d', $product->id) : null),
            'data' => $product !== null ? [
                'product_sku' => $product->sku,
                'quantity_on_hand' => $product->quantity_on_hand,
                'minimum_stock_level' => $product->minimum_stock_level,
            ] : null,
        ]);
    }

    private function hasOpenAlert(NotificationType $type, Product $product): bool
    {
        return Notification::query()
            ->where('type', $type->value)
            ->where('resource_type', 'product')
            ->where('resource_id', $product->id)
            ->where('created_at', '>=', Carbon::now()->subHours(self::DEDUPE_WINDOW_HOURS))
            ->exists();
    }

    /**
     * Delete open stock alerts of the given types for a product that has
     * recovered. Notifications are transient operational signals, not history —
     * the audit log and ledger carry the permanent record.
     *
     * @param  array<int, NotificationType>  $types
     */
    private function resolveOpenAlerts(Product $product, array $types): void
    {
        Notification::query()
            ->whereIn('type', array_map(static fn (NotificationType $t): string => $t->value, $types))
            ->where('resource_type', 'product')
            ->where('resource_id', $product->id)
            ->delete();
    }

    /**
     * Unread count for the bell badge.
     */
    public function unreadCountFor(User $user): int
    {
        if (! $user->hasPermission(Permission::NotificationsView)) {
            return 0;
        }

        return Notification::query()->unreadFor($user)->count();
    }

    /**
     * Mark one notification read for a user.
     */
    public function markRead(Notification $notification, User $user): void
    {
        if ($notification->user_id === $user->id) {
            $notification->forceFill(['read_at' => Carbon::now()])->save();

            return;
        }

        if ($notification->user_id === null) {
            NotificationRead::query()->updateOrCreate(
                ['notification_id' => $notification->id, 'user_id' => $user->id],
                ['read_at' => Carbon::now()],
            );
        }
    }

    /**
     * Mark everything currently visible to the user as read.
     */
    public function markAllRead(User $user): int
    {
        /** @var Collection<int, Notification> $unread */
        $unread = Notification::query()->unreadFor($user)->get();

        foreach ($unread as $notification) {
            $this->markRead($notification, $user);
        }

        return $unread->count();
    }
}
