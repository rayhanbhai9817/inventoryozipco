<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Business;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Business>
 */
final class BusinessFactory extends Factory
{
    protected $model = Business::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
            'legal_name' => $name.' LLC',
            'contact_email' => fake()->unique()->companyEmail(),
            'phone' => fake()->numerify('+1-###-###-####'),
            'industry' => fake()->randomElement(['Retail', 'Wholesale', 'Electronics', 'Apparel', 'Food service']),
            'timezone' => 'UTC',
            'currency' => 'USD',
            'default_minimum_stock_level' => 0,
            'is_active' => true,
            'settings' => [
                'notifications' => [
                    'low_stock_enabled' => true,
                    'out_of_stock_enabled' => true,
                ],
            ],
        ];
    }

    public function inactive(): self
    {
        return $this->state(['is_active' => false]);
    }
}
