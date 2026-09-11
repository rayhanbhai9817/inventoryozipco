'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Pagination } from '@/components/ui/table';
import { SegmentedControl } from '@/components/ui/tabs';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/data-source';
import { formatRelative } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { AppNotification, NotificationSeverity } from '@/types/api';
import { cn } from '@/lib/utils';

const SEVERITY_TOKENS: Record<
  NotificationSeverity,
  { icon: IconName; wrap: string; label: string }
> = {
  critical: {
    icon: 'alert-circle',
    wrap: 'bg-critical-50 text-critical-600 dark:bg-critical-700/20 dark:text-critical-200',
    label: 'Critical',
  },
  warning: {
    icon: 'alert-triangle',
    wrap: 'bg-caution-50 text-caution-600 dark:bg-caution-700/20 dark:text-caution-200',
    label: 'Warning',
  },
  success: {
    icon: 'check-circle',
    wrap: 'bg-positive-50 text-positive-600 dark:bg-positive-700/20 dark:text-positive-200',
    label: 'Done',
  },
  info: {
    icon: 'info',
    wrap: 'bg-info-50 text-info-600 dark:bg-info-700/20 dark:text-info-200',
    label: 'Info',
  },
};

export default function NotificationsPage() {
  const toast = useToast();
  const { refreshUnreadCount } = useAuth();

  const [view, setView] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);

  const { data, loading, error, reload, setData } = useAsync(
    () => fetchNotifications({ unread_only: view === 'unread', page, per_page: 25 }),
    [view, page],
  );

  const unreadCount = data?.meta.unread_count ?? 0;

  async function handleMarkRead(notification: AppNotification) {
    if (notification.is_read) return;

    // Optimistic: the badge and row update immediately, and a failure simply
    // refetches rather than showing an error for something this minor.
    setData((current) =>
      current
        ? {
            ...current,
            data: current.data.map((entry) =>
              entry.id === notification.id ? { ...entry, is_read: true } : entry,
            ),
            meta: { ...current.meta, unread_count: Math.max(0, (current.meta.unread_count ?? 1) - 1) },
          }
        : current,
    );

    try {
      await markNotificationRead(notification.id);
      await refreshUnreadCount();
    } catch {
      reload();
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true);

    try {
      await markAllNotificationsRead();
      await refreshUnreadCount();
      toast.success('All caught up', 'Every notification is marked as read.');
      reload();
    } catch {
      toast.error('That did not work', 'Please try again.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Stock alerts, recorded movements and administrative notices for your business."
        actions={
          <>
            <SegmentedControl
              aria-label="Notification filter"
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
              ]}
              value={view}
              onChange={(next) => {
                setView(next);
                setPage(1);
              }}
            />
            {unreadCount > 0 ? (
              <Button variant="secondary" icon="check" onClick={handleMarkAll} loading={markingAll}>
                Mark all read
              </Button>
            ) : null}
          </>
        }
      />

      <Card flush>
        <CardHeader
          padded
          title={view === 'unread' ? 'Unread notifications' : 'All notifications'}
          description={
            unreadCount > 0
              ? `${unreadCount} unread of ${data?.meta.total ?? 0}`
              : 'Nothing unread.'
          }
          icon="bell"
        />

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState label="Loading notifications…" />
        ) : (data?.data.length ?? 0) === 0 ? (
          <EmptyState
            icon={view === 'unread' ? 'check-circle' : 'bell'}
            title={view === 'unread' ? 'You are all caught up' : 'No notifications yet'}
            description={
              view === 'unread'
                ? 'Nothing is waiting for your attention.'
                : 'Low-stock alerts and recorded movements will appear here as they happen.'
            }
            action={view === 'unread' ? { label: 'View all', onClick: () => setView('all') } : undefined}
          />
        ) : (
          <>
            <ul className="divide-y divide-border-subtle">
              {data?.data.map((notification) => {
                const tokens = SEVERITY_TOKENS[notification.severity];
                const body = (
                  <div className="flex gap-3.5">
                    <span
                      className={cn(
                        'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        tokens.wrap,
                      )}
                    >
                      <Icon name={tokens.icon} size={17} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={cn(
                            'text-[0.8125rem] leading-snug',
                            notification.is_read
                              ? 'font-medium text-content-secondary'
                              : 'font-semibold text-content-primary',
                          )}
                        >
                          {notification.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          {!notification.is_read ? (
                            <span
                              className="h-2 w-2 rounded-full bg-brand-500"
                              aria-label="Unread"
                            />
                          ) : null}
                          <span className="text-xs whitespace-nowrap text-content-tertiary">
                            {formatRelative(notification.created_at)}
                          </span>
                        </div>
                      </div>

                      {notification.body ? (
                        <p className="mt-1 text-[0.8125rem] leading-relaxed text-content-secondary">
                          {notification.body}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral" size="sm">
                          {notification.type.label}
                        </Badge>
                        {notification.is_personal ? (
                          <Badge tone="info" size="sm">
                            For you
                          </Badge>
                        ) : null}
                        {notification.action_url ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                            View
                            <Icon name="arrow-right" size={12} />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                return (
                  <li
                    key={notification.id}
                    className={cn(
                      'transition-colors',
                      !notification.is_read && 'bg-brand-50/40 dark:bg-brand-950/25',
                    )}
                  >
                    {notification.action_url ? (
                      <Link
                        href={notification.action_url}
                        onClick={() => void handleMarkRead(notification)}
                        className="block px-5 py-4 transition-colors hover:bg-surface-sunken/60"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(notification)}
                        className="block w-full px-5 py-4 text-left transition-colors hover:bg-surface-sunken/60"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {data ? (
              <Pagination
                page={data.meta.current_page}
                lastPage={data.meta.last_page}
                total={data.meta.total}
                from={data.meta.from}
                to={data.meta.to}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          title="What generates a notification"
          description="You can mute most of these per person in Settings → Notifications."
          icon="info"
        />
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ['Low stock', 'A product reaches or drops below its minimum level.'],
            ['Out of stock', 'A product has nothing left on hand.'],
            ['Stock in / out recorded', 'A movement is recorded, with the new balance.'],
            ['Missing reference data', 'A product has no supplier or no reference price.'],
            ['Role changed', 'Your permissions in this business change.'],
            ['Administrative activity', 'Notices an Owner should see. These cannot be muted.'],
          ].map(([title, description]) => (
            <li key={title} className="flex gap-2.5">
              <Icon
                name="check-circle"
                size={15}
                className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400"
              />
              <div>
                <p className="text-[0.8125rem] font-medium text-content-primary">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-content-tertiary">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
