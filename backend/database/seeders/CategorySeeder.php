<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Backend Engineering', 'slug' => 'backend-engineering', 'description' => 'Server-side engineering, PHP/Laravel patterns, background processing'],
            ['name' => 'Frontend Engineering', 'slug' => 'frontend-engineering', 'description' => 'JavaScript/TypeScript, React, rendering performance'],
            ['name' => 'Databases & Query Optimization', 'slug' => 'databases', 'description' => 'SQL tuning, indexing strategy, query planning, caching layers'],
            ['name' => 'API & System Design', 'slug' => 'api-system-design', 'description' => 'API contracts, architectural approaches, integration patterns'],
            ['name' => 'Performance Engineering', 'slug' => 'performance', 'description' => 'Profiling, optimization techniques, benchmarking insights'],
            ['name' => 'DevOps & Cloud', 'slug' => 'devops-cloud', 'description' => 'CI/CD, containers, AWS, infrastructure optimization'],
            ['name' => 'Security Practices', 'slug' => 'security', 'description' => 'Developer-relevant security changes and practices'],
            ['name' => 'Developer Productivity', 'slug' => 'productivity', 'description' => 'Tooling, debugging techniques, workflow improvements'],
            ['name' => 'Architecture & Distributed Systems', 'slug' => 'architecture', 'description' => 'Scalability, queues, distributed design trade-offs'],
            ['name' => 'Tools & Emerging Tech', 'slug' => 'tools-emerging', 'description' => 'New releases, interesting projects, emerging technology'],
        ];

        foreach ($categories as $category) {
            Category::updateOrCreate(['slug' => $category['slug']], $category);
        }
    }
}
