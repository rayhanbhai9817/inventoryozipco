<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\Role;
use App\Models\Business;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
final class UserFactory extends Factory
{
    protected $model = User::class;

    /**
     * The hash is computed once per process rather than per user, which keeps
     * large test fixtures fast.
     */
    private static ?string $passwordHash = null;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'business_id' => Business::factory(),
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => self::$passwordHash ??= Hash::make('password'),
            'role' => Role::Staff,
            'job_title' => fake()->jobTitle(),
            'is_active' => true,
            'must_change_password' => false,
        ];
    }

    public function owner(): self
    {
        return $this->state(['role' => Role::Owner]);
    }

    public function manager(): self
    {
        return $this->state(['role' => Role::Manager]);
    }

    public function staff(): self
    {
        return $this->state(['role' => Role::Staff]);
    }

    public function inactive(): self
    {
        return $this->state(['is_active' => false]);
    }

    public function forBusiness(Business $business): self
    {
        return $this->state(['business_id' => $business->id]);
    }
}
