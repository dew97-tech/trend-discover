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
                'freshness' => 0.16,
                'momentum' => 0.13,
                'technical_relevance' => 0.16,
                'practical_usefulness' => 0.14,
                'novelty' => 0.18,
                'developer_interest' => 0.05,
                'discussion_potential' => 0.05,
                'source_reliability' => 0.05,
                'topic_focus' => 0.08,
                'saturation_penalty_weight' => 0.25,
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
                'lobsters_cron' => '10 */3 * * *',
                'devto_cron' => '45 */8 * * *',
                'rss_cron' => '20 */3 * * *',
                'youtube_cron' => '35 */6 * * *',
            ],
            group: 'collection',
        );
    }
}
