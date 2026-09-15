<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| One workflow, two processes
|--------------------------------------------------------------------------
| `pipeline:run` fetches every enabled source in parallel, then finds/groups
| new trends, scores them, and cleans up stale trends — so `schedule:work`
| and `queue:work` are the only processes needed. Each step keeps its own
| per-job log; manual commands (trends:collect / trends:detect / trends:score)
| still work for testing.
*/

Schedule::command('pipeline:run')->dailyAt('01:00')->withoutOverlapping();

// Nightly full re-score keeps decayed scores honest (touched trends were
// already scored by the pipeline).
Schedule::command('trends:score')->dailyAt('02:00');

// Nightly LinkedIn post: usefulness-first trend pick, exported to
// storage/app/private/daily-posts/{date}-*.{md,txt}.
Schedule::command('posts:nightly')->dailyAt('02:30')->withoutOverlapping();

// Gateway rotates its model roster; refresh cheap/fast fallbacks daily.
Schedule::command('ai:refresh-models')->dailyAt('03:20');

// Lying "running" rows (worker killed mid-job) break monitoring trust.
Schedule::command('jobs:reconcile-stale')->everyFifteenMinutes();
