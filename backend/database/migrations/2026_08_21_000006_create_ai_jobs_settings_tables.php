<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_generations', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 48);
            $table->string('kind', 48);
            $table->char('idempotency_key', 64)->unique();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('model', 64)->nullable();
            $table->unsignedInteger('tokens_in')->nullable();
            $table->unsignedInteger('tokens_out')->nullable();
            $table->decimal('cost_usd', 8, 4)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->string('status', 24)->default('success');
            $table->text('error')->nullable();
            $table->json('result')->nullable();
            $table->char('request_hash', 64)->index();
            $table->timestamps();

            $table->index(['kind', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('job_runs', function (Blueprint $table) {
            $table->id();
            $table->string('job_class', 191);
            $table->string('job_id', 64)->nullable();
            $table->string('batch_id', 64)->nullable();
            $table->string('status', 24)->default('queued');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->text('error')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['job_class', 'status', 'started_at']);
            $table->index('started_at');
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->string('group', 48)->default('general');
            $table->string('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('job_runs');
        Schema::dropIfExists('ai_generations');
    }
};
