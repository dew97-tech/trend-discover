<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingSeeder extends Seeder
{
    public function run(): void
    {
        SystemSetting::put(
            key: 'scoring.weights.default',
            value: [
                'freshness' => 0.18,
                'momentum' => 0.14,
                'technical_relevance' => 0.18,
                'practical_usefulness' => 0.15,
                'novelty' => 0.20,
                'developer_interest' => 0.05,
                'discussion_potential' => 0.05,
                'source_reliability' => 0.05,
                'saturation_penalty_weight' => 0.25,
                'min_ranking_score' => 55.0,
            ],
            group: 'scoring',
        );

        SystemSetting::put(
            key: 'generation.limits',
            value: [
                'max_generations_per_trend' => 3,
                'max_image_prompts_per_post' => 2,
                'daily_ai_call_budget' => 200,
            ],
            group: 'cost_control',
        );

        SystemSetting::put(
            key: 'collection.schedule',
            value: [
                'hn_cron' => '0 */4 * * *',
                'github_cron' => '30 */6 * * *',
                'reddit_cron' => '15 */4 * * *',
                'devto_cron' => '45 */8 * * *',
                'rss_cron' => '20 */3 * * *',
            ],
            group: 'collection',
        );
    }
}
