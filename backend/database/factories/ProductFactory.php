<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ProductUnit;
use App\Models\Business;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
final class ProductFactory extends Factory
{
    protected $model = Product::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'business_id' => Business::factory(),
            'category_id' => null,
            'sku' => 'FS-'.Str::upper(Str::random(8)),
            'name' => Str::title(fake()->unique()->words(3, true)),
            'description' => fake()->sentence(12),
            'unit' => fake()->randomElement(ProductUnit::cases()),
            'minimum_stock_level' => fake()->numberBetween(0, 25),
            'reorder_quantity' => fake()->numberBetween(10, 100),
            // Quantity is never set directly outside the inventory service; a
            // factory-made product starts empty and is filled via stockIn().
            'quantity_on_hand' => 0,
            'is_active' => true,
        ];
    }

    public function forBusiness(Business $business): self
    {
        return $this->state(['business_id' => $business->id]);
    }

    public function inCategory(Category $category): self
    {
        return $this->state([
            'business_id' => $category->business_id,
            'category_id' => $category->id,
        ]);
    }

    public function archived(): self
    {
        return $this->state(['is_active' => false, 'archived_at' => now()]);
    }

    public function withMinimumLevel(int $level): self
    {
        return $this->state(['minimum_stock_level' => $level]);
    }
}
