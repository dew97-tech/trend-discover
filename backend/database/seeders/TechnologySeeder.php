<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Technology;
use Illuminate\Database\Seeder;

class TechnologySeeder extends Seeder
{
    public function run(): void
    {
        $map = [
            'backend-engineering' => ['PHP', 'Laravel', 'Symfony', 'Composer', 'PHPUnit', 'Pest'],
            'frontend-engineering' => ['JavaScript', 'TypeScript', 'React', 'Vue.js', 'Next.js', 'Node.js', 'Vite', 'Tailwind CSS'],
            'databases' => ['MySQL', 'MariaDB', 'PostgreSQL', 'SQLite', 'Redis', 'MongoDB'],
            'api-system-design' => ['REST', 'GraphQL', 'gRPC', 'WebSockets', 'OAuth'],
            'performance' => ['Profiling', 'Load Testing', 'Caching'],
            'devops-cloud' => ['Docker', 'Kubernetes', 'AWS', 'GitHub Actions', 'Terraform', 'Nginx', 'Linux'],
            'security' => [],
            'productivity' => ['Git', 'PHPStan', 'Psalm', 'ESLint'],
            'architecture' => ['RabbitMQ', 'Kafka', 'SQS'],
            'tools-emerging' => ['AI Tooling', 'LLMs'],
        ];

        $slugs = [];
        foreach ($map as $categorySlug => $names) {
            $categoryId = Category::query()->where('slug', $categorySlug)->value('id');

            foreach ($names as $name) {
                $slug = str($name)->slug('-')->toString();

                if (isset($slugs[$slug])) {
                    continue;
                }

                $slugs[$slug] = true;

                Technology::updateOrCreate(
                    ['slug' => $slug],
                    [
                        'category_id' => $categoryId,
                        'name' => $name,
                        'aliases' => $this->aliasesFor($name),
                    ],
                );
            }
        }
    }

    private function aliasesFor(string $name): array
    {
        return match ($name) {
            'JavaScript' => ['JS', 'ECMAScript'],
            'TypeScript' => ['TS'],
            'Vue.js' => ['Vue', 'vuejs'],
            'Next.js' => ['NextJS'],
            'Node.js' => ['NodeJS', 'Node'],
            'Tailwind CSS' => ['TailwindCSS', 'Tailwind'],
            'PostgreSQL' => ['postgres', 'pgsql'],
            'MySQL' => ['mysql8'],
            'MariaDB' => ['mariadb-server'],
            'GitHub Actions' => ['gh-actions', 'GHA'],
            default => [],
        };
    }
}
