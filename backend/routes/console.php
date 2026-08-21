<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Trend collection schedule
|--------------------------------------------------------------------------
| Frequencies mirror system_settings key `collection.schedule`.
| Each run dispatches queued CollectSourceItemsJob per enabled source;
| ShouldBeUnique prevents overlap if a run is still in flight.
*/

Schedule::command('trends:collect hn')->cron('0 */4 * * *')->withoutOverlapping();
Schedule::command('trends:collect github')->cron('30 */6 * * *')->withoutOverlapping();
Schedule::command('trends:collect reddit')->cron('15 */4 * * *')->withoutOverlapping();
Schedule::command('trends:collect devto')->cron('45 */8 * * *')->withoutOverlapping();
Schedule::command('trends:collect rss')->cron('20 */3 * * *')->withoutOverlapping();

// Re-score trends nightly (Phase 3 will implement the scoring pipeline).
// Schedule::command('trends:score')->dailyAt('02:00');
