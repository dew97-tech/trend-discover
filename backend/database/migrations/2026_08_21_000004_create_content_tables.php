<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trend_id')->constrained()->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->text('hook')->nullable();
            $table->longText('body');
            $table->string('format', 48)->default('technical_insight');
            $table->string('tone', 32)->default('technical');
            $table->text('angle')->nullable();
            $table->string('status', 24)->default('draft');
            $table->decimal('quality_score', 5, 2)->nullable();
            $table->json('quality_breakdown')->nullable();
            $table->unsignedInteger('word_count')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->string('published_channel', 32)->nullable();
            $table->timestamps();

            $table->index(['status', 'updated_at']);
            $table->index(['trend_id', 'status']);
        });

        Schema::create('content_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_post_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->string('title')->nullable();
            $table->text('hook')->nullable();
            $table->longText('body');
            $table->json('meta')->nullable();
            $table->string('created_by', 16)->default('ai');
            $table->timestamp('created_at');

            $table->unique(['content_post_id', 'version']);
        });

        Schema::create('content_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_post_id')->constrained()->cascadeOnDelete();
            $table->string('type', 24);
            $table->string('status', 24)->default('pending');
            $table->json('spec')->nullable();
            $table->text('prompt_text')->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_images');
        Schema::dropIfExists('content_versions');
        Schema::dropIfExists('content_posts');
    }
};
