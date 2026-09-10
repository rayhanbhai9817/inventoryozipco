<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Business;
use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Category>
 */
final class CategoryFactory extends Factory
{
    protected $model = Category::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'business_id' => Business::factory(),
            'name' => Str::title($name),
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'description' => fake()->sentence(),
            'color' => fake()->randomElement(['#137A83', '#FF6A3D', '#6366F1', '#0EA5A4', '#A855F7', '#F59E0B']),
            'is_active' => true,
        ];
    }

    public function forBusiness(Business $business): self
    {
        return $this->state(['business_id' => $business->id]);
    }
}
