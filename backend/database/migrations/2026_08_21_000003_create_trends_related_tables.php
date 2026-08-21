<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trends', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('summary')->nullable();
            $table->string('status', 32)->default('discovered');
            $table->decimal('trend_score', 5, 2)->nullable();
            $table->decimal('novelty_score', 5, 2)->nullable();
            $table->decimal('freshness_score', 5, 2)->nullable();
            $table->decimal('momentum_score', 5, 2)->nullable();
            $table->decimal('relevance_score', 5, 2)->nullable();
            $table->decimal('usefulness_score', 5, 2)->nullable();
            $table->decimal('saturation_score', 5, 2)->nullable();
            $table->text('why_matters')->nullable();
            $table->json('angles')->nullable();
            $table->json('metrics')->nullable();
            $table->json('research')->nullable();
            $table->unsignedInteger('item_count')->default(0);
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('researched_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'trend_score']);
            $table->index('first_seen_at');
            $table->fullText(['title', 'summary']);
        });

        Schema::create('trend_signals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trend_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 64);
            $table->decimal('weight', 5, 2)->default(1);
            $table->json('value')->nullable();
            $table->timestamp('detected_at')->nullable();
            $table->timestamps();

            $table->index(['trend_id', 'type']);
        });

        Schema::create('trend_technology', function (Blueprint $table) {
            $table->foreignId('trend_id')->constrained()->cascadeOnDelete();
            $table->foreignId('technology_id')->constrained()->cascadeOnDelete();
            $table->primary(['trend_id', 'technology_id']);
        });

        Schema::create('trend_source_item', function (Blueprint $table) {
            $table->foreignId('trend_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_item_id')->constrained()->cascadeOnDelete();
            $table->primary(['trend_id', 'source_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trend_source_item');
        Schema::dropIfExists('trend_technology');
        Schema::dropIfExists('trend_signals');
        Schema::dropIfExists('trends');
    }
};
