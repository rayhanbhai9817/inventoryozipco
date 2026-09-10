<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Business;
use App\Models\User;

final class BusinessPolicy
{
    public function view(User $user, Business $business): bool
    {
        return $user->business_id === $business->id && $user->hasPermission(Permission::SettingsView);
    }

    public function update(User $user, Business $business): bool
    {
        return $user->business_id === $business->id && $user->hasPermission(Permission::SettingsManage);
    }

    public function manageRoles(User $user, Business $business): bool
    {
        return $user->business_id === $business->id && $user->hasPermission(Permission::RolesManage);
    }

    public function viewAuditLogs(User $user, Business $business): bool
    {
        return $user->business_id === $business->id && $user->hasPermission(Permission::AuditLogsView);
    }
}
