<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * In-app notifications.
 *
 * `user_id` null means the notification is addressed to the whole business and
 * is visible to any user with the `notifications.view` permission. Read state
 * for business-wide notifications is tracked in `notification_reads`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('business_id')->constrained('businesses')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('type', 64);
            $table->string('severity', 16)->default('info');
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('resource_type', 64)->nullable();
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->string('action_url')->nullable();
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['business_id', 'user_id', 'read_at']);
            $table->index(['business_id', 'created_at']);
            $table->index(['business_id', 'type']);
            // Used to avoid re-raising an identical open low-stock alert.
            $table->index(['business_id', 'type', 'resource_type', 'resource_id'], 'notifications_resource_index');
        });

        Schema::create('notification_reads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('notification_id')->constrained('notifications')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at');

            $table->unique(['notification_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_reads');
        Schema::dropIfExists('notifications');
    }
};
