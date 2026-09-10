<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Business;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Supplier>
 */
final class SupplierFactory extends Factory
{
    protected $model = Supplier::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'business_id' => Business::factory(),
            'name' => fake()->unique()->company(),
            'code' => 'SUP-'.Str::upper(Str::random(5)),
            'contact_name' => fake()->name(),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->numerify('+1-###-###-####'),
            'city' => fake()->city(),
            'country' => 'US',
            'default_lead_time_days' => fake()->numberBetween(2, 30),
            'is_active' => true,
        ];
    }

    public function forBusiness(Business $business): self
    {
        return $this->state(['business_id' => $business->id]);
    }

    public function inactive(): self
    {
        return $this->state(['is_active' => false]);
    }
}
