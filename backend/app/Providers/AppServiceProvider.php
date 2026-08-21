<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            \App\Repositories\Contracts\SourceItemRepositoryInterface::class,
            \App\Repositories\Eloquent\SourceItemRepository::class,
        );

        $this->app->bind(
            \App\Repositories\Contracts\TrendRepositoryInterface::class,
            \App\Repositories\Eloquent\TrendRepository::class,
        );

        $this->app->bind(
            \App\Repositories\Contracts\ContentPostRepositoryInterface::class,
            \App\Repositories\Eloquent\ContentPostRepository::class,
        );

        $this->app->bind(
            \App\Repositories\Contracts\JobRunRepositoryInterface::class,
            \App\Repositories\Eloquent\JobRunRepository::class,
        );
    }

    public function boot(): void
    {
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->string('email')->toString().'|'.$request->ip());
        });
    }
}
